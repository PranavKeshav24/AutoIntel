"use client";

import React, { useState } from "react";
import { DataSet } from "@/lib/types";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { DataProcessor } from "@/lib/dataProcessor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ExcelHandlerProps {
  onDataLoaded: (dataset: DataSet) => void;
  onError: (error: string) => void;
}

export function ExcelHandler({ onDataLoaded, onError }: ExcelHandlerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const convertSheetToCSV = (wb: XLSX.WorkBook, sheetName: string): string => {
    const worksheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(worksheet, { FS: ",", RS: "\n" });
  };

  const processSheet = async (
    wb: XLSX.WorkBook,
    sheetName: string,
    fname: string
  ) => {
    try {
      // Convert to CSV
      const csvText = convertSheetToCSV(wb, sheetName);

      // Parse CSV using Papa Parse
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          try {
            if (!results.data || results.data.length === 0) {
              onError("No data found in the selected sheet");
              setProcessing(false);
              return;
            }

            const dataset = DataProcessor.createDataSet(
              results.data,
              "excel",
              `${fname} - ${sheetName}`
            );

            if (dataset.rows.length === 0) {
              onError("No valid data rows found after processing");
              setProcessing(false);
              return;
            }

            onDataLoaded(dataset);
            setWorkbook(null);
            setSelectedSheet("");
            setFileName("");
          } catch (err) {
            console.error("Error creating dataset:", err);
            onError("Failed to process Excel data");
          } finally {
            setProcessing(false);
          }
        },
        error: (error: any) => {
          console.error("CSV parsing error:", error);
          onError(`Failed to parse sheet: ${error.message}`);
          setProcessing(false);
        },
      });
    } catch (err) {
      console.error("Error processing Excel sheet:", err);
      onError("Failed to process Excel data");
      setProcessing(false);
    }
  };

  const handleFile = async (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".xlsm", ".xlsb"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      onError("Please upload a valid Excel file (.xlsx, .xls, .xlsm, .xlsb)");
      return;
    }

    setProcessing(true);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        onError("No sheets found in Excel file");
        setProcessing(false);
        return;
      }

      // If only one sheet, process it directly
      if (wb.SheetNames.length === 1) {
        await processSheet(wb, wb.SheetNames[0], file.name);
      } else {
        // Multiple sheets: let user select
        setWorkbook(wb);
        setSelectedSheet(wb.SheetNames[0]);
        setProcessing(false);
      }
    } catch (err) {
      console.error("Error reading Excel file:", err);
      onError("Failed to read Excel file");
      setProcessing(false);
    }
  };

  const handleSheetSelection = () => {
    if (workbook && selectedSheet) {
      setProcessing(true);
      processSheet(workbook, selectedSheet, fileName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Show sheet selector if multiple sheets
  if (workbook && workbook.SheetNames.length > 1) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <p className="text-lg font-medium mb-2">Select a Sheet</p>
            <p className="text-sm text-muted-foreground">
              {fileName} contains {workbook.SheetNames.length} sheets
            </p>
          </div>
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a sheet" />
            </SelectTrigger>
            <SelectContent>
              {workbook.SheetNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={handleSheetSelection} disabled={processing}>
              {processing ? "Loading..." : "Load Sheet"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setWorkbook(null);
                setSelectedSheet("");
                setFileName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

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
            {processing ? "Processing Excel..." : "Upload Excel File"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports .xlsx, .xls, .xlsm, .xlsb
          </p>
        </div>
        <label htmlFor="excel-upload">
          <Button disabled={processing} asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Processing..." : "Choose File"}
            </span>
          </Button>
        </label>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls,.xlsm,.xlsb"
          onChange={handleFileInput}
          className="hidden"
          disabled={processing}
        />
      </div>
    </Card>
  );
}
