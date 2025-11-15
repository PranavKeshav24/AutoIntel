"use client";

import React, { useState, useEffect } from "react";
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
  DollarSign,
} from "lucide-react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CohereEmbeddings } from "@langchain/cohere";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";

// Global store for vector stores by namespace/datasetId
const vectorStores = new Map<string, MemoryVectorStore>();

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

interface TextPdfHandlerProps {
  onDataLoaded: (dataset: DataSet) => void;
  onError: (error: string) => void;
  type: "text" | "pdf";
}

// Text/PDF Handler
// Enhanced TextPdfHandler with comprehensive debugging and error handling

export function TextPdfHandler({
  onDataLoaded,
  onError,
  type,
}: TextPdfHandlerProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const handleFile = async (file: File) => {
    setProcessing(true);
    setProgress(0);
    setStatusMessage("Reading file...");

    try {
      let text: string;

      // Step 1: Extract text from file
      if (type === "pdf") {
        setStatusMessage("Extracting PDF content...");
        setProgress(10);

        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/text/extract-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || "Failed to extract PDF content");
        }

        const data = await response.json();
        text = data.text;
        console.log(`[Upload] PDF extracted: ${text.length} characters`);
      } else {
        text = await file.text();
        console.log(`[Upload] Text file read: ${text.length} characters`);
      }

      setProgress(20);
      setStatusMessage("Preparing dataset...");

      // Step 2: Generate unique dataset ID
      const datasetId = `${type}_${uuidv4()}`;
      const uploadedAt = new Date().toISOString();

      console.log(`[Upload] Generated datasetId: ${datasetId}`);

      setProgress(30);
      setStatusMessage("Indexing document server-side...");

      // Step 3: Index server-side (CRITICAL for analyze endpoint)
      console.log(
        `[Upload] Calling /api/text/index for datasetId: ${datasetId}`
      );

      const indexResponse = await fetch("/api/text/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          text,
          metadata: {
            fileType: type,
            source: file.name,
            uploadedAt,
          },
        }),
      });

      if (!indexResponse.ok) {
        const errorData = await indexResponse.json().catch(() => ({}));
        console.error("[Upload] Index failed:", errorData);
        throw new Error(
          errorData?.details ||
            errorData?.error ||
            "Failed to index document server-side."
        );
      }

      const indexResult = await indexResponse.json();
      const { chunkCount, datasetId: returnedDatasetId } = indexResult;

      console.log(`[Upload] Indexing successful:`, indexResult);
      console.log(`[Upload] Chunks created: ${chunkCount}`);
      console.log(`[Upload] Returned datasetId: ${returnedDatasetId}`);

      // Verify the returned datasetId matches
      if (returnedDatasetId && returnedDatasetId !== datasetId) {
        console.warn(
          `[Upload] DatasetId mismatch: sent "${datasetId}", got "${returnedDatasetId}"`
        );
      }

      // Step 4: Verify the vector store is accessible (with retry and longer delays)
      setProgress(60);
      setStatusMessage("Verifying vector store...");

      let verified = false;
      let verifyAttempts = 0;
      const maxVerifyAttempts = 5;
      const delays = [1000, 2000, 3000, 4000, 5000]; // Progressive delays

      while (!verified && verifyAttempts < maxVerifyAttempts) {
        verifyAttempts++;
        console.log(
          `[Upload] Verification attempt ${verifyAttempts}/${maxVerifyAttempts}`
        );

        // Progressive delay to allow Pinecone propagation
        const delay = delays[verifyAttempts - 1] || 5000;
        setStatusMessage(
          `Verifying vector store (attempt ${verifyAttempts}/${maxVerifyAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        try {
          const verifyResponse = await fetch(
            `/api/text/verify?datasetId=${encodeURIComponent(
              datasetId
            )}&testRetrieval=true`
          );

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log(`[Upload] Verify response:`, verifyData);

            // Check both existence and retrieval test
            if (verifyData.exists && verifyData.retrievalTest?.success) {
              verified = true;
              console.log(
                `✓ [Upload] Vector store verified and retrieval tested successfully`
              );
            } else if (verifyData.exists) {
              console.warn(
                `⚠️ [Upload] Vector store exists but retrieval test failed (attempt ${verifyAttempts})`
              );
            } else {
              console.warn(
                `⚠️ [Upload] Vector store not found (attempt ${verifyAttempts})`
              );
              console.log(
                `[Upload] Available datasets:`,
                verifyData.allIndexedDatasets
              );
            }
          }
        } catch (verifyError: any) {
          console.warn(
            `[Upload] Verification attempt ${verifyAttempts} failed:`,
            verifyError.message
          );
        }

        // Update progress
        setProgress(60 + (verifyAttempts / maxVerifyAttempts) * 15);
      }

      // Don't fail if verification doesn't pass - just warn
      if (!verified) {
        console.warn(
          `⚠️ [Upload] Vector store verification incomplete after ${maxVerifyAttempts} attempts. ` +
            `This may be due to Pinecone propagation delay. The dataset is indexed and should work shortly.`
        );
        setStatusMessage("Dataset indexed (verification pending)...");
        // Don't throw - continue with dataset creation
      } else {
        setStatusMessage("Vector store verified!");
      }

      // Step 5: Optional analysis test (only if verified)
      if (verified) {
        setProgress(78);
        setStatusMessage("Testing analysis endpoint...");

        try {
          console.log(
            `[Upload] Testing analyze endpoint with datasetId: ${datasetId}`
          );

          const testResponse = await fetch("/api/text/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              datasetId,
              query: "What is this document about? Provide a brief summary.",
              config: {
                model: "gemini-2.5-flash-lite",
              },
            }),
          });

          if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log(`✓ [Upload] Analysis endpoint test successful`);
            console.log(
              `[Upload] Test response:`,
              testData.answer?.substring(0, 100) + "..."
            );
          } else {
            const testError = await testResponse.json();
            console.warn(
              `⚠️ [Upload] Analysis endpoint test failed:`,
              testError
            );
          }
        } catch (testError: any) {
          console.warn(`⚠️ [Upload] Analysis test error:`, testError);
        }
      } else {
        console.log(`[Upload] Skipping analysis test - verification pending`);
      }

      setProgress(85);
      setStatusMessage("Creating dataset...");

      // Step 6: Create dataset for display
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.slice(0, 100).map((line, i) => ({
        line_number: i + 1,
        content: line.trim().substring(0, 200), // Preview only
      }));

      const dataset: DataSet = {
        schema: {
          fields: [
            { name: "line_number", type: "number" },
            { name: "content", type: "string" },
          ],
          rowCount: lines.length,
        },
        rows,
        source: {
          kind: type,
          name: file.name,
          meta: {
            datasetId,
            chunkCount: chunkCount ?? 0,
            indexed: true,
            indexedAt: uploadedAt,
            uploadedAt,
            totalLines: lines.length,
          },
        },
        id: datasetId,
      };

      setProgress(100);
      setStatusMessage("Complete!");

      console.log(`✓ [Upload] Dataset created successfully:`, {
        id: datasetId,
        type,
        fileName: file.name,
        lines: lines.length,
        chunks: chunkCount,
        verified,
      });

      // Show success message
      setTimeout(() => {
        onDataLoaded(dataset);
        setProcessing(false);
        setProgress(0);
        setStatusMessage("");

        // Optional: Show info toast about potential delay
        if (!verified) {
          console.info(
            `ℹ️ [Upload] Dataset indexed successfully but verification is pending. ` +
              `This is normal with Pinecone. The dataset should be ready in a few seconds.`
          );
        }
      }, 500);
    } catch (err: any) {
      console.error("[Upload] File processing error:", err);
      onError(err.message || `Failed to process ${type} file`);
      setProgress(0);
      setStatusMessage("");
      setProcessing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Upload {type.toUpperCase()} File</p>

        {processing && (
          <div className="w-full space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              {statusMessage}
            </p>
          </div>
        )}

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

        <p className="text-xs text-muted-foreground text-center">
          {type === "pdf"
            ? "PDF files will be extracted and indexed for AI analysis"
            : "Text files will be indexed for AI-powered search and analysis"}
        </p>
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch Reddit data");
      }

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
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/adsense/status");
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        console.log("AdSense auth status:", data);
      }
    } catch (err) {
      console.error("Failed to check auth status:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/adsense/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.requiresAuth) {
          setIsAuthenticated(false);
          window.location.href = "/api/adsense/auth";
          return;
        }

        throw new Error(errorData.error || "Failed to fetch AdSense data");
      }

      const data = await response.json();
      onDataLoaded(data.dataset);
    } catch (err: any) {
      onError(err.message || "Failed to fetch AdSense data");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = () => {
    window.location.href = "/api/adsense/auth";
  };

  if (checking) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Google AdSense</p>
            <p className="text-sm text-muted-foreground">
              {isAuthenticated
                ? "Connected and ready to fetch data"
                : "Connect your Google AdSense account"}
            </p>
          </div>
        </div>

        {isAuthenticated ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✓ Successfully authenticated with Google AdSense
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to authenticate with Google before fetching data
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {!isAuthenticated && (
            <Button onClick={handleAuth} className="w-full">
              <svg
                className="w-5 h-5 mr-2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Authenticate with Google
            </Button>
          )}

          <Button
            onClick={handleFetch}
            disabled={loading || !isAuthenticated}
            variant={isAuthenticated ? "default" : "outline"}
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Fetching AdSense Data...
              </>
            ) : (
              "Fetch AdSense Data (Last 90 Days)"
            )}
          </Button>

          {isAuthenticated && (
            <Button
              onClick={checkAuthStatus}
              variant="ghost"
              size="sm"
              className="w-full text-xs"
            >
              Refresh Authentication Status
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Fetches AdSense data for the last 90 days</p>
          <p>• Includes metrics: clicks, impressions, earnings, CTR, RPM</p>
          <p>• Grouped by date, ad unit, and country</p>
        </div>
      </div>
    </Card>
  );
}

// Export the vectorStores map for use in other parts of the application
export { vectorStores };
