
// src/assets/users/UserProfile.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  update,
  onValue,
  remove,
  set,
  push,
  serverTimestamp,
} from "firebase/database";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Heart from "../../assets/uploads/Heart";
import ShareButton from "../../assets/uploads/ShareBtn";

export default function UserProfile() {
  const { uid } = useParams();
  const [userData, setUserData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!uid) return;

    // user info
    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snap) => {
      if (snap.exists()) setUserData(snap.val());
    });

    // posts
    const postsRef = ref(db, "galleryImages");
    const unsubscribePosts = onValue(postsRef, (snap) => {
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([id, val]) => ({
          id,
          ...val,
        }));
        // check uid or userId
        const uPosts = all.filter(
          (p) => p.uid === uid || p.userId === uid
        );
        setPosts(uPosts);
      } else {
        setPosts([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [uid]);

  if (loading) return <p>Loading profile...</p>;
  if (!userData) return <p>No user found</p>;

  const isLocked = userData?.isLocked === true;
  const isFriend =
    currentUser && userData?.friends && userData.friends[currentUser.uid];
  const isFollowing =
    currentUser && userData?.followers && userData.followers[currentUser.uid];
  const hasRequested =
    currentUser &&
    userData?.followRequests?.received &&
    Object.keys(userData.followRequests.received || {}).includes(
      currentUser.uid
    );

  // follow request
  const sendRequest = async () => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: true,
    });
    toast.success("Follow request sent ✅");
  };

  // cancel request
  const cancelRequest = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
    });
    toast.info("Request canceled ❌");
  };

  // unfollow
  const unfollow = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followers/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/following/${uid}`]: null,
      [`usersData/${uid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${uid}`]: null,
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
    });
    toast.info("Unfollowed");
  };

  // like toggle
  const toggleLike = async (id) => {
    const userId = currentUser?.uid;
    if (!userId) return;
    const post = posts.find((p) => p.id === id);
    const alreadyLiked = post?.likes?.[userId];
    if (alreadyLiked) {
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    } else {
      await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
    }
  };

  // add comment
  const addComment = async (id) => {
    if (!commentText.trim()) return;
    await push(ref(db, `galleryImages/${id}/comments`), {
      userId: currentUser.uid,
      userName:
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "User",
      text: commentText.trim(),
      timestamp: serverTimestamp(),
    });
    setCommentText("");
  };

  // delete comment
  const deleteComment = async (postId, commentId, commentUserId) => {
    if (currentUser?.uid === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));
    }
  };

  return (
    <div className="container mt-3">
      {/* Profile info */}
      <div className="d-flex align-items-center mb-3">
        <img
          src={userData.photoURL || "https://via.placeholder.com/80"}
          alt="DP"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: 15,
          }}
        />
        <div>
          <h5>{userData.username}</h5>
          <p className="text-muted">{userData.email}</p>
        </div>
      </div>

      {/* Follow / Unfollow / Request */}
      {currentUser?.uid !== uid && (
        <div className="mb-3">
          {isFriend || isFollowing ? (
            <button className="btn btn-sm btn-danger" onClick={unfollow}>
              Unfollow
            </button>
          ) : hasRequested ? (
            <button
              className="btn btn-sm btn-secondary"
              onClick={cancelRequest}
            >
              Cancel Request
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={sendRequest}>
              Follow
            </button>
          )}
        </div>
      )}

      {/* Bio */}
      <p>{userData.bio || "No bio"}</p>

      {/* Posts */}
      {isLocked && !isFriend && currentUser?.uid !== uid ? (
        <p className="text-muted">This profile is locked 🔒</p>
      ) : (
        <div className="row">
          {posts.length === 0 && <p>No posts</p>}
          {posts.map((post) => {
            const liked = post.likes?.[currentUser?.uid];
            const likeCount = post.likes
              ? Object.keys(post.likes).length
              : 0;

            return (
              <div key={post.id} className="col-12 col-md-6 mb-3">
                <div className="card shadow-sm">
                  {/* Media */}
                  {post.type === "image" && (
                    <img
                      src={post.url || post.src}
                      alt="img"
                      className="card-img-top rounded"
                      style={{ objectFit: "cover", height: 250 }}
                    />
                  )}
                  {post.type === "video" && (
                    <video
                      src={post.url || post.src}
                      className="card-img-top rounded"
                      style={{ objectFit: "cover", height: 250 }}
                      controls
                    />
                  )}
                  {post.type === "pdf" && (
                    <iframe
                      src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
                        post.url || post.src
                      )}`}
                      className="card-img-top rounded"
                      style={{ height: 250 }}
                      title="PDF Preview"
                    />
                  )}

                  {/* Body */}
                  <div className="card-body">
                    <p className="mb-2">
                      <strong>{post.user}</strong> {post.caption}
                    </p>

                    {/* Actions */}
                    <div className="d-flex align-items-center mb-2">
                      <Heart
                        liked={liked}
                        onToggle={() => toggleLike(post.id)}
                      />
                      <small className="text-muted ms-2">
                        {likeCount} likes
                      </small>

                      <button
                        className="btn btn-link p-0 mx-3 text-dark"
                        onClick={() => {
                          const input = document.getElementById(
                            `commentInput_${post.id}`
                          );
                          if (input) input.focus();
                        }}
                      >
                        <i className="bi bi-chat fs-5"></i>
                      </button>

                      <ShareButton link={post.url || post.src} />
                    </div>

                    {/* Comments */}
                    <div
                      className="comments mb-2"
                      style={{ maxHeight: 120, overflowY: "auto" }}
                    >
                      {post.comments &&
                        Object.entries(post.comments)
                          .sort(
                            (a, b) =>
                              (a[1].timestamp || 0) -
                              (b[1].timestamp || 0)
                          )
                          .map(([cid, comment]) => (
                            <div
                              key={cid}
                              className="d-flex justify-content-between align-items-start mb-1"
                              style={{ fontSize: "0.9rem" }}
                            >
                              <div>
                                <strong>
                                  {comment.userName || "User"}
                                </strong>
                                : {comment.text}
                              </div>
                              {currentUser?.uid === comment.userId && (
                                <button
                                  className="btn btn-sm btn-close"
                                  onClick={() =>
                                    deleteComment(
                                      post.id,
                                      cid,
                                      comment.userId
                                    )
                                  }
                                />
                              )}
                            </div>
                          ))}
                    </div>

                    {/* Add comment */}
                    <div className="input-group">
                      <input
                        id={`commentInput_${post.id}`}
                        type="text"
                        className="form-control"
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && addComment(post.id)
                        }
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => addComment(post.id)}
                        disabled={!commentText.trim()}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
