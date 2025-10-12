"use client";

import React, { useState } from "react";
import { DataSet } from "@/lib/types";
import { DataProcessor } from "@/lib/dataProcessor";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet } from "lucide-react";

interface CsvHandlerProps {
  onDataLoaded: (dataset: DataSet) => void;
  onError: (error: string) => void;
}

export function CsvHandler({ onDataLoaded, onError }: CsvHandlerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      onError("Please upload a CSV file");
      return;
    }

    setProcessing(true);
    try {
      const text = await file.text();

      Papa.parse(text, {
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
              onError("No data found in CSV file");
              setProcessing(false);
              return;
            }

            const dataset = DataProcessor.createDataSet(
              results.data,
              "csv",
              file.name
            );

            if (dataset.rows.length === 0) {
              onError("No valid data rows found after processing");
              setProcessing(false);
              return;
            }

            onDataLoaded(dataset);
            setProcessing(false);
          } catch (err) {
            console.error("Error creating dataset:", err);
            onError("Failed to process CSV data");
            setProcessing(false);
          }
        },
        error: (error: any) => {
          console.error("Papa Parse error:", error);
          onError(`CSV parsing error: ${error.message}`);
          setProcessing(false);
        },
      });
    } catch (err) {
      console.error("File reading error:", err);
      onError("Failed to read CSV file");
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <Card
      className={`p-8 border-2 border-dashed transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">
            {processing ? "Processing CSV..." : "Upload CSV File"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop or click to browse
          </p>
        </div>
        <label htmlFor="csv-upload">
          <Button disabled={processing} asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Processing..." : "Choose File"}
            </span>
          </Button>
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileInput}
          className="hidden"
          disabled={processing}
        />
      </div>
    </Card>
  );
}
