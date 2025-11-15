"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { Link } from "lucide-react";
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
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<string>("connection");

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const validExtensions = [".db", ".sqlite", ".sqlite3"];
    const fileExtension = file.name
      .toLowerCase()
      .slice(file.name.lastIndexOf("."));

    if (!validExtensions.includes(fileExtension)) {
      onError("Invalid file type. Please upload a .db or .sqlite file");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      onError("Please select a file to upload");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onError("Authentication required. Please log in.");
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/upload-sqlite`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload SQLite file");
      }

      const data = await response.json();

      // Use the file name or response data as the connection identifier
      const connectionIdentifier =
        data.connection_string || data.db_path || selectedFile.name;
      onUriLoaded(connectionIdentifier, dbType);

      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        "sqlite-file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      onError(err.message || "Failed to upload SQLite database file");
    } finally {
      setUploadLoading(false);
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
              Upload a database file or enter a connection string
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="connection" className="flex-1">
              <Link className="h-4 w-4 mr-2" />
              Connection String
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label
                htmlFor="sqlite-file-input"
                className="block text-sm font-medium"
              >
                Select SQLite Database File
              </label>
              <Input
                id="sqlite-file-input"
                type="file"
                accept=".db,.sqlite,.sqlite3"
                onChange={handleFileSelect}
                disabled={uploadLoading}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <Button
              onClick={handleFileUpload}
              disabled={uploadLoading || !selectedFile}
              className="w-full"
            >
              {uploadLoading ? "Uploading..." : "Upload & Connect"}
            </Button>
          </TabsContent>

          <TabsContent value="connection" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Connection String
              </label>
              <Input
                placeholder="sqlite:///path/to/database.db"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleConnect}
              disabled={loading || !connectionString.trim()}
              className="w-full"
            >
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </TabsContent>
        </Tabs>
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
