import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        try {
          if (user) {
            setUser(user);
            localStorage.setItem("currentUser", JSON.stringify(user));
          } else {
            setUser(null);
            localStorage.removeItem("currentUser");
          }
          setError(null);
        } catch (err) {
          setError(err.message);
          console.error("Auth state change error:", err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setError(error.message);
        setLoading(false);
        console.error("Auth observer error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
};