// src/hooks/useUserRelations.js
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../assets/utils/firebaseConfig';
import { ref, onValue, update, get } from 'firebase/database';

const userCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// Helper Functions
const getUsersDetails = async (uids) => {
  if (!uids.length) return [];

  const now = Date.now();
  const users = await Promise.all(
    uids.map(async (userId) => {
      const cached = userCache.get(userId);
      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
      }

      try {
        const userSnap = await get(ref(db, `usersData/${userId}`));
        if (userSnap.exists()) {
          const userData = { uid: userId, ...userSnap.val() };
          userCache.set(userId, { data: userData, timestamp: now });
          return userData;
        }
        return null;
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return null;
      }
    })
  );
  return users.filter(Boolean);
};

export const calculateRelationship = (currentUserId, targetUser, relations) => {
  if (!targetUser || !currentUserId || !relations) {
    return {
      isOwner: false,
      isFollowing: false,
      isFollower: false,
      isFriend: false,
      hasSentRequest: false,
      hasReceivedRequest: false,
      isBlocked: false,
      isBlockedBy: false,
    };
  }
  
  const isFollowing = relations.following?.some(u => u?.uid === targetUser.uid) || false;
  const isFollower = relations.followers?.some(u => u?.uid === targetUser.uid) || false;
  const isFriend = isFollowing && isFollower; // Mutual following = friends
  const hasSentRequest = relations.sentRequests?.some(u => u?.uid === targetUser.uid) || false;
  const hasReceivedRequest = relations.requested?.some(u => u?.uid === targetUser.uid) || false;
  const isBlocked = relations.blocked?.some(u => u?.uid === targetUser.uid) || false;
  const isBlockedBy = relations.blockedBy?.some(u => u?.uid === targetUser.uid) || false;
  
  return {
    isOwner: currentUserId === targetUser.uid,
    isFollowing,
    isFollower,
    isFriend,
    hasSentRequest,
    hasReceivedRequest,
    isBlocked,
    isBlockedBy,
  };
};

export const useUserRelations = (uid) => {
  const [relations, setRelations] = useState({
    followers: [], following: [], requested: [], 
    sentRequests: [], friends: [], blocked: [], blockedBy: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const relationsRef = ref(db, `usersData/${uid}`);
    const unsubscribe = onValue(relationsRef, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setRelations({ followers: [], following: [], requested: [], sentRequests: [], friends: [], blocked: [], blockedBy: [] });
          setLoading(false);
          return;
        }

        const data = snapshot.val();
        
        // Get blockedBy users
        const allUsersRef = ref(db, 'usersData');
        const allUsersSnap = await get(allUsersRef);
        const allUsers = allUsersSnap.val() || {};
        const blockedByUsers = [];
        
        Object.keys(allUsers).forEach(userId => {
          if (userId !== uid && allUsers[userId]?.blockedUsers?.[uid]) {
            blockedByUsers.push(userId);
          }
        });

        const [
          followers, following, requested, sentRequests, friends, blocked, blockedBy
        ] = await Promise.all([
          getUsersDetails(Object.keys(data.followers || {})),
          getUsersDetails(Object.keys(data.following || {})),
          getUsersDetails(Object.keys(data.followRequests?.received || {})),
          getUsersDetails(Object.keys(data.followRequests?.sent || {})),
          getUsersDetails(Object.keys(data.friends || {})),
          getUsersDetails(Object.keys(data.blockedUsers || {})),
          getUsersDetails(blockedByUsers)
        ]);

        setRelations({ followers, following, requested, sentRequests, friends, blocked, blockedBy });
        setError(null);
      } catch (error) {
        console.error('Error processing relations:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  return { relations, calculateRelationship, loading, error };
};

export const useUserActions = () => {
  const currentUser = auth.currentUser;

  const updateRelations = async (updates) => {
    try {
      await update(ref(db), updates);
      // Clear cache for affected users
      Object.keys(updates).forEach(key => {
        if (key.includes('usersData/')) {
          const uid = key.split('/')[1];
          userCache.delete(uid);
        }
      });
      if (currentUser) userCache.delete(currentUser.uid);
    } catch (error) {
      console.error('Relation update error:', error);
      throw error;
    }
  };

  const followUser = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    if (currentUser.uid === targetUid) throw new Error('Cannot follow yourself');

    const [currentUserSnap, targetUserSnap] = await Promise.all([
      get(ref(db, `usersData/${currentUser.uid}`)),
      get(ref(db, `usersData/${targetUid}`))
    ]);

    const currentUserData = currentUserSnap.val() || {};
    const targetUserData = targetUserSnap.val() || {};

    // Check if target user follows back
    const targetFollowsBack = targetUserData.following?.[currentUser.uid];
    const updates = {};

    if (targetFollowsBack) {
      // Mutual follow - become friends immediately
      updates[`usersData/${currentUser.uid}/following/${targetUid}`] = {
        uid: targetUid, 
        username: targetUserData.username, 
        photoURL: targetUserData.photoURL, 
        timestamp: Date.now()
      };
      updates[`usersData/${targetUid}/followers/${currentUser.uid}`] = {
        uid: currentUser.uid, 
        username: currentUserData.username, 
        photoURL: currentUserData.photoURL, 
        timestamp: Date.now()
      };
      updates[`usersData/${currentUser.uid}/friends/${targetUid}`] = {
        uid: targetUid, 
        username: targetUserData.username, 
        photoURL: targetUserData.photoURL, 
        timestamp: Date.now()
      };
      updates[`usersData/${targetUid}/friends/${currentUser.uid}`] = {
        uid: currentUser.uid, 
        username: currentUserData.username, 
        photoURL: currentUserData.photoURL, 
        timestamp: Date.now()
      };
      // Remove any pending requests
      updates[`usersData/${targetUid}/followRequests/received/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUid}`] = null;
    } else {
      // Send follow request
      updates[`usersData/${targetUid}/followRequests/received/${currentUser.uid}`] = {
        uid: currentUser.uid, 
        username: currentUserData.username,
        photoURL: currentUserData.photoURL,
        timestamp: Date.now()
      };
      updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUid}`] = {
        uid: targetUid, 
        username: targetUserData.username,
        photoURL: targetUserData.photoURL,
        timestamp: Date.now()
      };
    }

    await updateRelations(updates);
  };

  const cancelFollowRequest = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    const updates = {
      [`usersData/${targetUid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${targetUid}`]: null
    };
    await updateRelations(updates);
  };

  const acceptRequest = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');

    const [currentUserSnap, targetUserSnap] = await Promise.all([
      get(ref(db, `usersData/${currentUser.uid}`)),
      get(ref(db, `usersData/${targetUid}`))
    ]);

    const currentUserData = currentUserSnap.val() || {};
    const targetUserData = targetUserSnap.val() || {};

    const updates = {
      // Remove requests
      [`usersData/${currentUser.uid}/followRequests/received/${targetUid}`]: null,
      [`usersData/${targetUid}/followRequests/sent/${currentUser.uid}`]: null,
      // Add mutual follow
      [`usersData/${currentUser.uid}/following/${targetUid}`]: {
        uid: targetUid, 
        username: targetUserData.username, 
        photoURL: targetUserData.photoURL, 
        timestamp: Date.now()
      },
      [`usersData/${targetUid}/followers/${currentUser.uid}`]: {
        uid: currentUser.uid, 
        username: currentUserData.username, 
        photoURL: currentUserData.photoURL, 
        timestamp: Date.now()
      },
      // Add to friends
      [`usersData/${currentUser.uid}/friends/${targetUid}`]: {
        uid: targetUid, 
        username: targetUserData.username, 
        photoURL: targetUserData.photoURL, 
        timestamp: Date.now()
      },
      [`usersData/${targetUid}/friends/${currentUser.uid}`]: {
        uid: currentUser.uid, 
        username: currentUserData.username, 
        photoURL: currentUserData.photoURL, 
        timestamp: Date.now()
      }
    };

    await updateRelations(updates);
  };

  const declineRequest = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    const updates = {
      [`usersData/${currentUser.uid}/followRequests/received/${targetUid}`]: null,
      [`usersData/${targetUid}/followRequests/sent/${currentUser.uid}`]: null
    };
    await updateRelations(updates);
  };

  const unfollowUser = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    const updates = {
      [`usersData/${targetUid}/followers/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/following/${targetUid}`]: null,
      [`usersData/${targetUid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${targetUid}`]: null,
      [`usersData/${targetUid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${targetUid}`]: null
    };
    await updateRelations(updates);
  };

  const removeFollower = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    const updates = {
      [`usersData/${currentUser.uid}/followers/${targetUid}`]: null,
      [`usersData/${targetUid}/following/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${targetUid}`]: null,
      [`usersData/${targetUid}/friends/${currentUser.uid}`]: null
    };
    await updateRelations(updates);
  };

  const blockUser = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    
    const [currentUserSnap, targetUserSnap] = await Promise.all([
      get(ref(db, `usersData/${currentUser.uid}`)),
      get(ref(db, `usersData/${targetUid}`))
    ]);

    const targetUserData = targetUserSnap.val() || {};
    const updates = {
      [`usersData/${currentUser.uid}/blockedUsers/${targetUid}`]: {
        uid: targetUid, 
        username: targetUserData.username, 
        photoURL: targetUserData.photoURL,
        timestamp: Date.now()
      },
      // Remove all relationships
      [`usersData/${currentUser.uid}/followers/${targetUid}`]: null,
      [`usersData/${currentUser.uid}/following/${targetUid}`]: null,
      [`usersData/${currentUser.uid}/friends/${targetUid}`]: null,
      [`usersData/${targetUid}/followers/${currentUser.uid}`]: null,
      [`usersData/${targetUid}/following/${currentUser.uid}`]: null,
      [`usersData/${targetUid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/received/${targetUid}`]: null,
      [`usersData/${targetUid}/followRequests/sent/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${targetUid}`]: null,
      [`usersData/${targetUid}/followRequests/received/${currentUser.uid}`]: null
    };
    await updateRelations(updates);
  };

  const unblockUser = async (targetUid) => {
    if (!currentUser) throw new Error('Login required');
    const updates = {
      [`usersData/${currentUser.uid}/blockedUsers/${targetUid}`]: null
    };
    await updateRelations(updates);
  };

  return {
    followUser, 
    unfollowUser, 
    removeFollower, 
    acceptRequest, 
    declineRequest, 
    cancelFollowRequest, 
    blockUser, 
    unblockUser
  };
};