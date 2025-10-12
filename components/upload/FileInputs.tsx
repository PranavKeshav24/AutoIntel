"use client";

import React from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, Upload } from "lucide-react";

export function CsvExcelDrop({ onCsv, onExcel }: { onCsv: (f: File) => void; onExcel: (f: File) => void }) {
  const onDrop = React.useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") onCsv(f);
    else if (ext === "xlsx" || ext === "xls") onExcel(f);
  }, [onCsv, onExcel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  return (
    <Card className="p-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? "bg-primary/5" : ""}`}
      >
        <input {...getInputProps()} />
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-primary" />
        <p className="text-muted-foreground mb-3">
          {isDragActive ? "Drop the file here" : "Drag and drop CSV/Excel here, or click to select"}
        </p>
        <Button>
          <Upload className="mr-2" />
          Select File
        </Button>
      </div>
    </Card>
  );
}

export function GoogleSheetsInput({ onSubmit }: { onSubmit: (sheetUrl: string) => void }) {
  const [url, setUrl] = React.useState("");
  return (
    <Card className="p-4">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Google Sheets CSV export URL" />
        <Button onClick={() => url && onSubmit(url)}>Load</Button>
      </div>
      <div className="text-xs text-muted-foreground mt-2">Use a CSV export URL. See FRONTEND_USAGE.md in autointel-package.</div>
    </Card>
  );
}

export function FileInputGeneric({ accept, onFile }: { accept: string; onFile: (f: File) => void }) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  return (
    <Card className="p-4">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Button onClick={() => ref.current?.click()}>Choose File</Button>
    </Card>
  );
}


