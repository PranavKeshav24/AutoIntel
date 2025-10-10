"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type VirtualTryOnItem = {
  id: string;
  user_id: string;
  human_image_url: string;
  garment_image_url: string;
  cloth_type: string;
  result_image_url: string;
  created_at: string;
  updated_at: string;
};

type UserContextType = {
  user: {
    name: string;
    email: string;
    phone_number: string;
    profile_pic: string;
    is_email_verified: boolean;
    is_phone_verified: boolean;
    is_google_verified: boolean;
    VirtualTryOn: VirtualTryOnItem[];
  } | null;
  setUser: (user: UserContextType["user"]) => void;
  fetchUserData: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserContextType["user"]>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem("token");
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
          "Failed to delete account:",
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
    const token = localStorage.getItem("token");
    if (token !== authToken) {
      setAuthToken(token);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchUserData();
    } else {
      setUser(null);
    }
  }, [authToken, fetchUserData]);

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
