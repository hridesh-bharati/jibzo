// // src/assets/users/UserProfile.jsx
// import React, { useEffect, useState } from "react";
// import { db, auth } from "../../assets/utils/firebaseConfig";
// import { ref, update, onValue, remove, set, push, serverTimestamp } from "firebase/database";
// import { useParams, Link } from "react-router-dom";
// import { toast } from "react-toastify";
// import Heart from "../../assets/uploads/Heart";
// import ShareButton from "../../assets/uploads/ShareBtn";

// export default function UserProfile() {
//   const { uid } = useParams();
//   const [userData, setUserData] = useState(null);
//   const [posts, setPosts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [commentText, setCommentText] = useState("");
//   const [filter, setFilter] = useState("all");
//   const currentUser = auth.currentUser;

//   useEffect(() => {
//     if (!uid) return;

//     const userRef = ref(db, `usersData/${uid}`);
//     const unsubscribeUser = onValue(userRef, (snap) => {
//       if (snap.exists()) setUserData(snap.val());
//     });

//     const postsRef = ref(db, "galleryImages");
//     const unsubscribePosts = onValue(postsRef, (snap) => {
//       if (snap.exists()) {
//         const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
//         const uPosts = all.filter((p) => p.uid === uid || p.userId === uid);
//         setPosts(uPosts);
//       } else setPosts([]);
//       setLoading(false);
//     });

//     return () => {
//       unsubscribeUser();
//       unsubscribePosts();
//     };
//   }, [uid]);

//   if (loading) return <p className="text-center mt-5">Loading profile...</p>;
//   if (!userData) return <p className="text-center mt-5">No user found</p>;

//   const isLocked = userData?.isLocked === true;
//   const isFriend = currentUser && userData?.friends?.[currentUser.uid];
//   const isFollowing = currentUser && userData?.followers?.[currentUser.uid];
//   const hasRequested =
//     currentUser &&
//     userData?.followRequests?.received &&
//     Object.keys(userData.followRequests.received || {}).includes(currentUser.uid);

//   // Follow / Unfollow / Request handlers
//   const sendRequest = async () => {
//     if (!currentUser) return toast.error("Login first!");
//     await update(ref(db), {
//       [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: true,
//       [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: true,
//     });
//     toast.success("Follow request sent ✅");
//   };
//   const cancelRequest = async () => {
//     if (!currentUser) return;
//     await update(ref(db), {
//       [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
//       [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
//     });
//     toast.info("Request canceled ❌");
//   };
//   const unfollow = async () => {
//     if (!currentUser) return;
//     await update(ref(db), {
//       [`usersData/${uid}/followers/${currentUser.uid}`]: null,
//       [`usersData/${currentUser.uid}/following/${uid}`]: null,
//       [`usersData/${uid}/friends/${currentUser.uid}`]: null,
//       [`usersData/${currentUser.uid}/friends/${uid}`]: null,
//       [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
//       [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
//     });
//     toast.info("Unfollowed");
//   };

//   // Likes and comments
//   const toggleLike = async (id) => {
//     const userId = currentUser?.uid;
//     if (!userId) return;
//     const post = posts.find((p) => p.id === id);
//     const alreadyLiked = post?.likes?.[userId];
//     if (alreadyLiked) await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
//     else await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
//   };
//   const addComment = async (id) => {
//     if (!commentText.trim()) return;
//     await push(ref(db, `galleryImages/${id}/comments`), {
//       userId: currentUser.uid,
//       userName: currentUser.displayName || currentUser.email?.split("@")[0] || "User",
//       text: commentText.trim(),
//       timestamp: serverTimestamp(),
//     });
//     setCommentText("");
//   };
//   const deleteComment = async (postId, commentId, commentUserId) => {
//     if (currentUser?.uid === commentUserId) {
//       await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));
//     }
//   };

//   const filteredPosts = filter === "all" ? posts : posts.filter((p) => p.type === filter);

//   return (
//     <div className="container mx-auto p-0">
//       {/* Wallpaper & Profile */}
//       <div className="w-100 bg-dark">
//         <div
//           className="position-relative w-100 mb-5"
//           style={{
//             backgroundImage: `url(${userData.wallpaper || "https://via.placeholder.com/900x200"})`,
//             backgroundSize: "cover",
//             backgroundPosition: "center",
//             height: "170px",
//           }}
//         >
//           <div
//             className="position-absolute d-flex align-items-center justify-content-around w-100 px-2"
//             style={{ top: "85%", transform: "translateY(-50%)" }}
//           >
//             {/* DP on left */}
//             <img
//               src={userData.photoURL || "icons/avatar.jpg"}
//               alt="Profile"
//               className="rounded-circle shadow-sm border border-3"
//               width={120}
//               height={120}
//               style={{ objectFit: "cover" }}
//             />

//             {/* Username & Email on right */}
//             <div className="text-white ms-3 small">
//               <h5 className="fw-bolder">{userData.username}</h5>
//               <p className="fw-bold small">{userData.email}</p>
//             </div>
//           </div>
//         </div>
//       </div>



//       <div className="container">
//         {/* Followers / Following */}
//         {!(isLocked && !isFriend && currentUser?.uid !== uid) && (
//           <div className="d-flex gap-2 mb-3 flex-wrap">
//             <Link to={`/followers/${uid}`} className="btn btn-sm btn-outline-primary">
//               Followers: {userData.followers ? Object.keys(userData.followers).length : 0}
//             </Link>
//             <Link to={`/following/${uid}`} className="btn btn-sm btn-outline-success">
//               Following: {userData.following ? Object.keys(userData.following).length : 0}
//             </Link>
//             {currentUser?.uid === uid && userData.followRequests?.received && (
//               <Link to={`/requested/${uid}`} className="btn btn-sm btn-outline-warning">
//                 Requests: {Object.keys(userData.followRequests.received).length}
//               </Link>
//             )}
//           </div>
//         )}

//         {/* Follow / Unfollow Buttons */}
//         {currentUser?.uid !== uid && (
//           <div className="mb-3">
//             {isFriend || isFollowing ? (
//               <button className="btn btn-sm btn-danger" onClick={unfollow}>
//                 Unfollow
//               </button>
//             ) : hasRequested ? (
//               <button className="btn btn-sm btn-secondary" onClick={cancelRequest}>
//                 Cancel Request
//               </button>
//             ) : (
//               <button className="btn btn-sm btn-primary" onClick={sendRequest}>
//                 Follow
//               </button>
//             )}
//           </div>
//         )}
//         {/* Bio */}
//         <p className="mb-3">{userData.bio || "No bio"}</p>

//       </div>

//       {/* Post Filters */}
//       <div className="mb-3 d-flex align-items-center justify-content-center gap-2 flex-wrap border-top pt-2">
//         {["all", "image", "video", "pdf"].map((type) => (
//           <button
//             key={type}
//             className={`btn btn-sm px-3 ${filter === type ? "btn-primary" : "btn-outline-secondary"}`}
//             onClick={() => setFilter(type)}
//           >
//             {type === "all" ? "All" : type === "image" ? "Photo" : type === "video" ? "Video" : "PDF"}
//           </button>
//         ))}
//       </div>

//       {/* Posts */}
//       {isLocked && !isFriend && currentUser?.uid !== uid ? (
//         <p className="text-muted">This profile is locked 🔒</p>
//       ) : (
//         <div className="row pb-5">
//           {filteredPosts.length === 0 && <p>No posts</p>}
//           {filteredPosts.map((post) => {
//             const liked = post.likes?.[currentUser?.uid];
//             const likeCount = post.likes ? Object.keys(post.likes).length : 0;

//             return (
//               <div key={post.id} className="col-12 col-md-6 mb-3">
//                 <div className="card shadow-sm">
//                   {/* Media */}
//                   {post.type === "image" && (
//                     <img
//                       src={post.url || post.src}
//                       alt="img"
//                       className="card-img-top rounded"
//                       style={{ objectFit: "cover", height: 250 }}
//                     />
//                   )}
//                   {post.type === "video" && (
//                     <video
//                       src={post.url || post.src}
//                       className="card-img-top rounded"
//                       style={{ objectFit: "cover", height: 250 }}
//                       controls
//                     />
//                   )}
//                   {post.type === "pdf" && (
//                     <iframe
//                       src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
//                         post.url || post.src
//                       )}`}
//                       className="card-img-top rounded"
//                       style={{ height: 250 }}
//                       title="PDF Preview"
//                     />
//                   )}

//                   {/* Card Body */}
//                   <div className="card-body">
//                     <p className="mb-2">
//                       <strong>{post.user}</strong> {post.caption}
//                     </p>

//                     {/* Actions */}
//                     <div className="d-flex align-items-center mb-2">
//                       <Heart liked={liked} onToggle={() => toggleLike(post.id)} />
//                       <small className="text-muted ms-2">{likeCount} likes</small>
//                       <button
//                         className="btn btn-link p-0 mx-3 text-dark"
//                         onClick={() => document.getElementById(`commentInput_${post.id}`)?.focus()}
//                       >
//                         <i className="bi bi-chat fs-5"></i>
//                       </button>
//                       <ShareButton link={post.url || post.src} />
//                       {post.type === "pdf" && (
//                         <button
//                           className="bg-light btn btn-sm"
//                           onClick={() => window.open(post.url || post.src, "_blank")}
//                         >
//                           <i className="bi bi-file-earmark-pdf fs-1 text-danger"></i> Open
//                         </button>
//                       )}
//                     </div>

//                     {/* Comments */}
//                     <div className="comments mb-2" style={{ maxHeight: 120, overflowY: "auto" }}>
//                       {post.comments &&
//                         Object.entries(post.comments)
//                           .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
//                           .map(([cid, comment]) => (
//                             <div
//                               key={cid}
//                               className="d-flex justify-content-between align-items-start mb-1"
//                               style={{ fontSize: "0.9rem" }}
//                             >
//                               <div>
//                                 <strong>{comment.userName || "User"}</strong>: {comment.text}
//                               </div>
//                               {currentUser?.uid === comment.userId && (
//                                 <button
//                                   className="btn btn-sm btn-close"
//                                   onClick={() => deleteComment(post.id, cid, comment.userId)}
//                                 />
//                               )}
//                             </div>
//                           ))}
//                     </div>

//                     {/* Add comment */}
//                     <div className="input-group">
//                       <input
//                         id={`commentInput_${post.id}`}
//                         type="text"
//                         className="form-control"
//                         placeholder="Add a comment..."
//                         value={commentText}
//                         onChange={(e) => setCommentText(e.target.value)}
//                         onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
//                       />
//                       <button className="btn btn-primary" onClick={() => addComment(post.id)} disabled={!commentText.trim()}>
//                         Post
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }
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
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import Heart from "../../assets/uploads/Heart.jsx"; // Ensure .jsx if needed
import ShareButton from "../../assets/uploads/ShareBtn.jsx"; // Ensure .jsx

export default function UserProfile() {
  const { uid } = useParams();
  const [userData, setUserData] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState({}); // store per-post comments
  const [filter, setFilter] = useState("all");
  const currentUser = auth.currentUser;

  // 🔹 Fetch profile user data
  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snap) => {
      if (snap.exists()) setUserData(snap.val());
    });

    const postsRef = ref(db, "galleryImages");
    const unsubscribePosts = onValue(postsRef, (snap) => {
      const all = snap.exists()
        ? Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }))
        : [];
      const uPosts = all.filter((p) => p.uid === uid || p.userId === uid);
      setPosts(uPosts);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [uid]);

  // 🔹 Fetch current logged in user data
  useEffect(() => {
    if (!currentUser) return;
    const curRef = ref(db, `usersData/${currentUser.uid}`);
    return onValue(curRef, (snap) => {
      if (snap.exists()) setCurrentUserData(snap.val());
    });
  }, [currentUser]);

  if (loading) return <p className="text-center mt-5">Loading profile...</p>;
  if (!userData) return <p className="text-center mt-5">No user found</p>;

  // 🔒 Lock & Friends logic
  const isLocked = userData?.isLocked === true;
  const isFriend =
    currentUser &&
    (userData?.friends?.[currentUser.uid] ||
      currentUserData?.friends?.[uid]);
  const isFollowing = currentUser && userData?.followers?.[currentUser.uid];
  const hasRequested =
    currentUser &&
    userData?.followRequests?.received &&
    Object.keys(userData.followRequests.received || {}).includes(
      currentUser.uid
    );

  // ✅ Follow / Unfollow / Request handlers
  const sendRequest = async () => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: true,
    });
    toast.success("Follow request sent ✅");
  };

  const cancelRequest = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
    });
    toast.info("Request canceled ❌");
  };

  const unfollow = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followers/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/following/${uid}`]: null,
      [`usersData/${uid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
    });
    toast.info("Unfollowed");
  };

  // ✅ Likes and comments
  const toggleLike = async (id) => {
    const userId = currentUser?.uid;
    if (!userId) return;
    const post = posts.find((p) => p.id === id);
    const alreadyLiked = post?.likes?.[userId];
    if (alreadyLiked)
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    else await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
  };

  const addComment = async (id) => {
    const text = commentText[id]?.trim();
    if (!text) return;
    await push(ref(db, `galleryImages/${id}/comments`), {
      userId: currentUser.uid,
      userName:
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "User",
      text,
      timestamp: serverTimestamp(),
    });
    setCommentText((prev) => ({ ...prev, [id]: "" }));
  };

  const deleteComment = async (postId, commentId, commentUserId) => {
    if (currentUser?.uid === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));
    }
  };

  const filteredPosts =
    filter === "all" ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="container mx-auto p-0">
      {/* Wallpaper & Profile */}
      <div className="w-100 bg-dark">
        <div
          className="position-relative w-100 mb-5 pb-3"
          style={{
            backgroundImage: `url(${userData.wallpaper || "https://via.placeholder.com/900x200"
              })`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "170px",
          }}
        >
          <div
            className="position-absolute d-flex align-items-center justify-content-start w-100 px-2"
            style={{ top: "85%", transform: "translateY(-50%)" }}
          >
            {/* DP */}
            <img
              src={userData.photoURL || "icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle shadow-sm border border-3"
              width={120}
              height={120}
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* Follow / Unfollow */}
      {currentUser?.uid !== uid && (
        <div className="text-end me-2">
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

      <div className="ms-3 small">
        <h5 className="fw-bolder">{userData.username}</h5>
        {currentUser?.uid !== uid && (
          <p className="fw-bolder text-muted">{userData.email}</p>
        )}
      </div>

      {/* Locked Profile */}
      {isLocked && !isFriend && currentUser?.uid !== uid ? (
        <div
          className="d-flex flex-column align-items-center justify-content-center text-muted"
          style={{ minHeight: "30vh" }}
        >
          <i className="bi bi-person-heart display-1 mb-3 fs-1 text-secondary"></i>
          <h2 className="fw-bold">This profile is locked 🔒</h2>
          <p className="mt-2">Follow to see posts and details</p>
        </div>
      ) : (
        <>
          {/* Followers / Following */}
          <div className="d-flex gap-2 m-3 flex-wrap">
            <Link
              to={`/followers/${uid}`}
              className="btn btn-sm btn-outline-primary"
            >
              Followers:{" "}
              {userData.followers ? Object.keys(userData.followers).length : 0}
            </Link>
            <Link
              to={`/following/${uid}`}
              className="btn btn-sm btn-outline-success"
            >
              Following:{" "}
              {userData.following ? Object.keys(userData.following).length : 0}
            </Link>
            {currentUser?.uid === uid && userData.followRequests?.received && (
              <Link
                to={`/requested/${uid}`}
                className="btn btn-sm btn-outline-warning"
              >
                Requests:{" "}
                {Object.keys(userData.followRequests.received).length}
              </Link>
            )}
          </div>

          {/* Bio */}
          <p className="m-3">{userData.bio || "No bio"}</p>

          {/* Post Filters */}
          <div className="mb-3 d-flex align-items-center justify-content-center gap-2 flex-wrap border-top pt-2">
            {["all", "image", "video", "pdf"].map((type) => (
              <button
                key={type}
                className={`btn btn-sm px-3 ${filter === type ? "btn-primary" : "btn-outline-secondary"
                  }`}
                onClick={() => setFilter(type)}
              >
                {type === "all"
                  ? "All"
                  : type === "image"
                    ? "Photo"
                    : type === "video"
                      ? "Video"
                      : "PDF"}
              </button>
            ))}
          </div>

          {/* Posts */}
          <div className="row pb-5">
            {filteredPosts.length === 0 && (
              <div className="text-center">No posts</div>
            )}
            {filteredPosts.map((post) => {
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
                          post.url || ""
                        )}`}
                        className="card-img-top rounded"
                        style={{ height: 250 }}
                        title="PDF Preview"
                      />
                    )}

                    {/* Card Body */}
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
                        <small className="text-muted ms-2">{likeCount} likes</small>
                        <button
                          className="btn btn-link p-0 mx-3 text-dark"
                          onClick={() =>
                            document
                              .getElementById(`commentInput_${post.id}`)
                              ?.focus()
                          }
                        >
                          <i className="bi bi-chat fs-5"></i>
                        </button>
                        <ShareButton link={post.url || post.src} />
                        {post.type === "pdf" && (
                          <button
                            className="bg-light btn btn-sm"
                            onClick={() =>
                              window.open(post.url || post.src, "_blank")
                            }
                          >
                            <i className="bi bi-file-earmark-pdf fs-1 text-danger"></i>{" "}
                            Open
                          </button>
                        )}
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
                                  <strong>{comment.userName || "User"}</strong>
                                  : {comment.text}
                                </div>
                                {currentUser?.uid === comment.userId && (
                                  <button
                                    className="btn btn-sm btn-close"
                                    onClick={() =>
                                      deleteComment(post.id, cid, comment.userId)
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
                          value={commentText[post.id] || ""}
                          onChange={(e) =>
                            setCommentText((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && addComment(post.id)
                          }
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => addComment(post.id)}
                          disabled={!commentText[post.id]?.trim()}
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
        </>
      )}
    </div>
  );
}
