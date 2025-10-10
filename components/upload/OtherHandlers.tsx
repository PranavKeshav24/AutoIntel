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

// JSON Handler
export function JsonHandler({ onDataLoaded, onError }: any) {
  const [processing, setProcessing] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      onError("Please upload a JSON file");
      return;
    }

    setProcessing(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed.rows || parsed.data || [];

      if (rows.length === 0) {
        onError("No data found in JSON file");
        setProcessing(false);
        return;
      }

      const dataset = DataProcessor.createDataSet(
        rows,
        "json" as any,
        file.name
      );
      onDataLoaded(dataset);
    } catch (err: any) {
      onError(err.message || "Failed to parse JSON file");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <FileJson className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Upload JSON File</p>
        <label htmlFor="json-upload">
          <Button disabled={processing} asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Processing..." : "Choose File"}
            </span>
          </Button>
        </label>
        <input
          id="json-upload"
          type="file"
          accept=".json,application/json"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          disabled={processing}
        />
      </div>
    </Card>
  );
}

// Text/PDF Handler
export function TextPdfHandler({ onDataLoaded, onError, type }: any) {
  const [processing, setProcessing] = useState(false);

  const handleFile = async (file: File) => {
    setProcessing(true);
    try {
      const text = await file.text();
      // Simple text parsing - split by lines
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.map((line, i) => ({
        line_number: i + 1,
        content: line.trim(),
      }));

      const dataset = DataProcessor.createDataSet(rows, type, file.name);
      onDataLoaded(dataset);
    } catch (err: any) {
      onError(err.message || `Failed to process ${type} file`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Upload {type.toUpperCase()} File</p>
        <label htmlFor={`${type}-upload`}>
          <Button disabled={processing} asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Processing..." : "Choose File"}
            </span>
          </Button>
        </label>
        <input
          id={`${type}-upload`}
          type="file"
          accept={type === "pdf" ? ".pdf" : ".txt,text/plain"}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          disabled={processing}
        />
      </div>
    </Card>
  );
}

// Database Connection Handler
export function DatabaseHandler({ onDataLoaded, onError, dbType }: any) {
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      onError("Please enter a connection string");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/database/${dbType}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });

      if (!response.ok) throw new Error("Failed to connect to database");

      const data = await response.json();
      onDataLoaded(data.dataset);
      setConnectionString("");
    } catch (err: any) {
      onError(err.message || `Failed to connect to ${dbType}`);
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

// Reddit Handler
export function RedditHandler({ onDataLoaded, onError }: any) {
  const [subreddit, setSubreddit] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!subreddit.trim()) {
      onError("Please enter a subreddit name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/reddit/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subreddit: subreddit.replace(/^r\//, "") }),
      });

      if (!response.ok) throw new Error("Failed to fetch Reddit data");

      const data = await response.json();
      onDataLoaded(data.dataset);
      setSubreddit("");
    } catch (err: any) {
      onError(err.message || "Failed to fetch Reddit data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Fetch Reddit Data</p>
            <p className="text-sm text-muted-foreground">
              Enter a subreddit name
            </p>
          </div>
        </div>
        <Input
          placeholder="e.g., datascience"
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleFetch()}
          disabled={loading}
        />
        <Button onClick={handleFetch} disabled={loading} className="w-full">
          {loading ? "Fetching..." : "Fetch Posts"}
        </Button>
      </div>
    </Card>
  );
}

// AdSense Handler
export function AdSenseHandler({ onDataLoaded, onError }: any) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!apiKey.trim()) {
      onError("Please enter your AdSense API key");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/adsense/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) throw new Error("Failed to fetch AdSense data");

      const data = await response.json();
      onDataLoaded(data.dataset);
    } catch (err: any) {
      onError(err.message || "Failed to fetch AdSense data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <p className="text-lg font-medium">Connect Google AdSense</p>
          <p className="text-sm text-muted-foreground">
            Enter your AdSense API credentials
          </p>
        </div>
        <Input
          type="password"
          placeholder="AdSense API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleFetch} disabled={loading} className="w-full">
          {loading ? "Fetching..." : "Fetch Data"}
        </Button>
      </div>
    </Card>
  );
}
