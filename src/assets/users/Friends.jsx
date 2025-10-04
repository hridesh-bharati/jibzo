// src/components/Friends.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, auth } from '../utils/firebaseConfig';
import { ref, onValue, update } from 'firebase/database';
import { toast } from 'react-toastify';

export default function Friends() {
    const { uid: paramUid } = useParams();
    const currentUser = auth.currentUser;
    const uid = paramUid || currentUser?.uid;

    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) return;

        const userRef = ref(db, `usersData/${uid}`);
        const unsubscribe = onValue(userRef, (snapshot) => {
            const data = snapshot.val();

            // Get friends (mutual follows)
            const friendsData = data?.friends ? Object.keys(data.friends) : [];

            // Fetch user details
            fetchUserDetails(friendsData).then(friendsDetails => {
                setFriends(friendsDetails);
                setLoading(false);
            });
        });

        return () => unsubscribe();
    }, [uid]);

    const fetchUserDetails = async (uids) => {
        const userPromises = uids.map(uid =>
            new Promise((resolve) => {
                const userRef = ref(db, `usersData/${uid}`);
                onValue(userRef, (snapshot) => {
                    const data = snapshot.val();
                    resolve({ uid, ...data });
                }, { onlyOnce: true });
            })
        );
        return Promise.all(userPromises);
    };

    // Unfriend user
    const unfriendUser = async (targetUID) => {
        if (!currentUser?.uid) return;

        try {
            const updates = {};
            updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
            updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
            updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
            updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
            updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
            updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
            await update(ref(db), updates);
            toast.info('Unfriended ❌');
        } catch (error) {
            console.error('Unfriend error:', error);
            toast.error('Failed to unfriend');
        }
    };

    if (loading) {
        return (
            <div className="min-vh-100 d-flex justify-content-center align-items-center">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3"></div>
                    <p className="text-muted">Loading friends...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-12 col-lg-10 col-xl-8">
                    <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
                        <div>
                            <h4 className="mb-1 text-success fw-bold">Friends ({friends.length})</h4>
                            {/* <p className="text-muted mb-0">Mutual follows</p> */}
                        </div>
                        <Link to="/all-insta-users" className="btn btn-primary btn-sm">
                            <i className="bi bi-people me-1"></i>Discover More
                        </Link>
                    </div>

                    {friends.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded-3 shadow-sm">
                            <i className="bi bi-people display-1 text-muted mb-3"></i>
                            <h5 className="text-muted">No friends yet</h5>
                            <p className="text-muted mb-3">
                                {currentUser?.uid === uid
                                    ? "When you follow someone back and they follow you, they'll appear here as friends."
                                    : "This user doesn't have any mutual friends yet."
                                }
                            </p>
                            <Link to="/all-insta-users" className="btn btn-primary">Find People to Follow</Link>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {friends.map((user) => (
                                <div key={user.uid} className="col-12">
                                    <div className="card border-0 shadow-sm mb-3">
                                        <div className="card-body">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div
                                                    className="d-flex align-items-center flex-grow-1"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => window.location.href = `/user-profile/${user.uid}`}
                                                >
                                                    <img
                                                        src={user.photoURL || '/icons/avatar.jpg'}
                                                        alt={user.username}
                                                        className="rounded-circle me-3"
                                                        style={{ width: 50, height: 50, objectFit: 'cover' }}
                                                    />
                                                    <div className='small'>
                                                        <h6 className="mb-0 fw-bold">{user.username || 'Unnamed User'}</h6>
                                                        {user.displayName && (
                                                            <p className="mb-0 text-muted small">{user.displayName}</p>
                                                        )}
                                                        <span className="badge bg-success mt-1 me-4 ">Friends</span>
                                                    </div>
                                                </div>

                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => unfriendUser(user.uid)}
                                                >
                                                    Unfriend
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}