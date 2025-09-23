import { db } from "../utils/firebaseConfig";
import { ref, get } from "firebase/database";

const sanitizeUsername = (username) => {
  if (!username) throw new Error("Username cannot be empty");
  if (/\s/.test(username)) throw new Error("Username cannot contain spaces");
  if (!/^[a-zA-Z0-9._]+$/.test(username))
    throw new Error("Username can only contain letters, numbers, underscores, and dots");
  return username;
};

const UniqueeName = async (username) => {
  const cleanUsername = sanitizeUsername(username).toLowerCase();
  let finalUsername = cleanUsername;
  let counter = 0;

  const snapshot = await get(ref(db, "usersData"));
  const data = snapshot.val();
  const usernames = data
    ? Object.values(data).map((u) => u.username.toLowerCase())
    : [];

  // ✅ Check partial match: reject if cleanUsername is substring of any existing username
  while (
    usernames.some(
      (u) => u.includes(finalUsername) || finalUsername.includes(u)
    )
  ) {
    counter++;
    finalUsername = `${cleanUsername}_${counter}`;
  }

  return finalUsername;
};

export default UniqueeName;
