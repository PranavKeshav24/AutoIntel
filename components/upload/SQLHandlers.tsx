"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database } from "lucide-react";

interface SQLHandlerProps {
  onUriLoaded: (uri: string, dbType: string) => void;
  onError: (error: string) => void;
  dbType?: string;
}

// PostgreSQL Database Connection Handler
export function PostgresHandler({
  onUriLoaded,
  onError,
  dbType = "postgresql",
}: SQLHandlerProps) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onError("Authentication required. Please log in.");
      return;
    }

    setLoading(true);
    try {
      // Save the PostgreSQL connection to user profile
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_BASE_URL
        }/user?postgres_db_url=${encodeURIComponent(connectionString)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to save PostgreSQL connection"
        );
      }

      const data = await response.json();
      onUriLoaded(connectionString, dbType);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || "Failed to connect to PostgreSQL database");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Connect to PostgreSQL</p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string
            </p>
          </div>
        </div>
        <Input
          placeholder="postgresql://user:password@host:port/database"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleConnect} disabled={loading} className="w-full">
          {loading ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </Card>
  );
}

// SQLite Database Connection Handler
export function SQLiteHandler({
  onUriLoaded,
  onError,
  dbType = "sqlite",
}: SQLHandlerProps) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onError("Authentication required. Please log in.");
      return;
    }

    setLoading(true);
    try {
      // Seed the SQLite connection to the user account
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/sqlite/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ connectionString }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to connect to SQLite");
      }

      const data = await response.json();
      onUriLoaded(connectionString, dbType);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || "Failed to connect to SQLite database");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Connect to SQLite</p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string or file path
            </p>
          </div>
        </div>
        <Input
          placeholder="sqlite:///path/to/database.db"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleConnect} disabled={loading} className="w-full">
          {loading ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </Card>
  );
}

// MySQL Database Connection Handler
export function MySQLHandler({
  onUriLoaded,
  onError,
  dbType = "mysql",
}: SQLHandlerProps) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onError("Authentication required. Please log in.");
      return;
    }

    setLoading(true);
    try {
      // Seed the MySQL connection to the user account
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/mysql/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ connectionString }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to connect to MySQL");
      }

      const data = await response.json();
      onUriLoaded(connectionString, dbType);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || "Failed to connect to MySQL database");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Connect to MySQL</p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string
            </p>
          </div>
        </div>
        <Input
          placeholder="mysql://user:password@host:port/database"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleConnect} disabled={loading} className="w-full">
          {loading ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </Card>
  );
}
