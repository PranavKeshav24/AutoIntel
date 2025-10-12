"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

type UserContextType = {
  user: {
    name: string;
    email: string;
    phone_number: string;
    profile_pic: string;
    is_email_verified: boolean;
    is_phone_verified: boolean;
    is_google_verified: boolean;
  } | null;
  setUser: (user: UserContextType["user"]) => void;
  fetchUserData: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserContextType["user"]>(null);
  const { isLoggedIn } = useAuth();

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/user`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      } else {
        console.error(
          "Failed to fetch user data:",
          JSON.stringify(data.detail || "No details provided")
        );
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserData();
    } else {
      setUser(null);
    }
  }, [isLoggedIn, fetchUserData]);

  return (
    <UserContext.Provider value={{ user, setUser, fetchUserData }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
