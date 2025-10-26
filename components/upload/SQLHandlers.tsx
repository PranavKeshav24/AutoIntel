"use client";

import React, { useState } from "react";
import { DataSet } from "@/lib/types";
import { DataProcessor } from "@/lib/dataProcessor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Database,
  FileJson,
  FileText,
  MessageSquare,
} from "lucide-react";

// Postgres Database Connection Handler
export function PostgresHandler({
  onUriLoaded,
  onError,
  dbType = "Postgres",
}: any) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    setLoading(true);
    try {
      // Change this with the Postgres connection API endpoint
      const response = await fetch(`/api/database/${dbType}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      if (!response.ok) throw new Error("Failed to connect to database");

      const data = await response.json();
      onUriLoaded(connectionString);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || `Failed to connect to Postgres database`);
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
            <p className="text-lg font-medium">
              Connect to {dbType.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string
            </p>
          </div>
        </div>
        <Input
          placeholder="Connection string..."
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

// SQL Lite Database Connection Handler
export function SQLiteHandler({
  onUriLoaded,
  onError,
  dbType = "SQLite",
}: any) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    setLoading(true);
    try {
      // Change this with the SQL Lite connection API endpoint
      const response = await fetch(`/api/database/${dbType}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      if (!response.ok) throw new Error("Failed to connect to database");

      const data = await response.json();
      onUriLoaded(data.dataset);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || `Failed to connect to SQLite database`);
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
            <p className="text-lg font-medium">
              Connect to {dbType.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string
            </p>
          </div>
        </div>
        <Input
          placeholder="Connection string..."
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
export function MySQLHandler({ onUriLoaded, onError, dbType = "MySQL" }: any) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    setLoading(true);
    try {
      // Change this with the MYSQL connection API endpoint
      const response = await fetch(`/api/database/${dbType}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      if (!response.ok) throw new Error("Failed to connect to database");

      const data = await response.json();
      onUriLoaded(data.dataset);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || `Failed to connect to MySQL database`);
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
            <p className="text-lg font-medium">
              Connect to {dbType.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground">
              Enter your database connection string
            </p>
          </div>
        </div>
        <Input
          placeholder="Connection string..."
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
