import { db } from "./firebaseConfig";
import { ref, runTransaction, onValue } from "firebase/database";

const VISITOR_KEY = "jibzo_visitor_id";

/**
 * Generate a unique visitor ID
 */
function generateVisitorId() {
  return "visitor_" + Math.random().toString(36).substr(2, 9);
}

/**
 * Track visits and unique visitors
 */
export const trackVisitor = () => {
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  // Increment total visits
  const visitsRef = ref(db, "visitorData/totalVisits");
  runTransaction(visitsRef, (current) => (current || 0) + 1);

  // Mark this visitor as unique
  const uniqueRef = ref(db, `visitorData/uniqueVisitors/${visitorId}`);
  runTransaction(uniqueRef, (current) => (current === null ? 1 : current));
};

/**
 * Fetch visitor stats
 * callback receives: { totalVisits, totalUnique }
 */
export const getVisitorStats = (callback) => {
  const statsRef = ref(db, "visitorData");
  onValue(statsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const totalVisits = data.totalVisits || 0;
    const totalUnique = data.uniqueVisitors ? Object.keys(data.uniqueVisitors).length : 0;
    callback({ totalVisits, totalUnique });
  });
};
