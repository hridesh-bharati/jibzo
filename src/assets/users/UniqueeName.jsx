// src\assets\users\UniqueeName.jsx
const UniqueeName = async (username) => {
  let finalUsername = username;
  let exists = true;
  let counter = 0;

  while (exists) {
    const snapshot = await ref(db, "usersData").once("value").then(snap => snap.val());
    const usernames = snapshot ? Object.values(snapshot).map(u => u.username.toLowerCase()) : [];

    if (!usernames.includes(finalUsername.toLowerCase())) {
      exists = false;
    } else {
      counter++;
      finalUsername = `${username}_${counter}`; // e.g., Hridesh_1, Hridesh_2...
    }
  }

  return finalUsername;
};
