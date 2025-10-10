"use client";

import React, { useState } from "react";
import { DataSet } from "@/lib/types";
import { DataProcessor } from "@/lib/dataProcessor";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Loader2 } from "lucide-react";

interface SheetsHandlerProps {
  onDataLoaded: (dataset: DataSet) => void;
  onError: (error: string) => void;
}

export function SheetsHandler({ onDataLoaded, onError }: SheetsHandlerProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      onError("Please enter a Google Sheets URL");
      return;
    }

    if (!url.includes("docs.google.com/spreadsheets")) {
      onError("Invalid Google Sheets URL");
      return;
    }

    setLoading(true);

    try {
      // Extract spreadsheet ID
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Could not extract spreadsheet ID from URL");
      }

      const spreadsheetId = match[1];

      // Extract GID if present
      const gidMatch = url.match(/[#&]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : "0";

      // Construct CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

      // Fetch CSV
      const response = await fetch(csvUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Google Sheet not found or not publicly accessible. Make sure the sheet is shared with 'Anyone with the link'"
          );
        }
        throw new Error(`Failed to fetch sheet (Status: ${response.status})`);
      }

      const csvText = await response.text();

      // Parse CSV using Papa Parse
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          try {
            if (results.errors.length > 0) {
              console.warn("CSV parsing warnings:", results.errors);
            }

            if (!results.data || results.data.length === 0) {
              onError("No data found in Google Sheet");
              setLoading(false);
              return;
            }

            const dataset = DataProcessor.createDataSet(
              results.data,
              "sheets",
              `Google Sheet (ID: ${spreadsheetId})`
            );

            if (dataset.rows.length === 0) {
              onError("No valid data rows found after processing");
              setLoading(false);
              return;
            }

            onDataLoaded(dataset);
            setUrl("");
          } catch (err) {
            console.error("Error creating dataset:", err);
            onError("Failed to process Google Sheet data");
          } finally {
            setLoading(false);
          }
        },
        error: (error: any) => {
          console.error("Papa Parse error:", error);
          onError(`CSV parsing error: ${error.message}`);
          setLoading(false);
        },
      });
    } catch (err: any) {
      console.error("Error loading Google Sheet:", err);
      onError(err.message || "Failed to load Google Sheet");
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Link className="h-8 w-8 text-primary" />
          <div>
            <p className="text-lg font-medium">Connect Google Sheets</p>
            <p className="text-sm text-muted-foreground">
              Enter a public Google Sheets URL
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Google Sheets URL</label>
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Make sure the sheet is shared as "Anyone with the link"
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            "Load Sheet"
          )}
        </Button>
      </div>
    </Card>
  );
}
