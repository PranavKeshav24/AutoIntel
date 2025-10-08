"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table as TableIcon, Upload, Database, FileText, FileJson } from "lucide-react";

export type DataSourceType =
  | "csv"
  | "excel"
  | "sheets"
  | "mongodb"
  | "postgres"
  | "sqlite"
  | "mysql"
  | "pdf"
  | "text"
  | "json";

export const SOURCE_LABELS: Record<DataSourceType, string> = {
  csv: "CSV",
  excel: "Excel",
  sheets: "Google Sheets",
  mongodb: "MongoDB",
  postgres: "Postgres",
  sqlite: "SQLite",
  mysql: "MySQL",
  pdf: "PDF",
  text: "Text",
  json: "JSON",
};

export function SourcePicker({ value, onChange }: { value: DataSourceType; onChange: (v: DataSourceType) => void }) {
  const items: { key: DataSourceType; icon: React.ReactNode; desc: string }[] = [
    { key: "csv", icon: <Upload className="w-5 h-5" />, desc: "Upload .csv" },
    { key: "excel", icon: <Upload className="w-5 h-5" />, desc: "Upload .xlsx/.xls" },
    { key: "sheets", icon: <TableIcon className="w-5 h-5" />, desc: "Link Google Sheet" },
    { key: "mongodb", icon: <Database className="w-5 h-5" />, desc: "Query MongoDB" },
    { key: "postgres", icon: <Database className="w-5 h-5" />, desc: "Use your Postgres (Profile)" },
    { key: "sqlite", icon: <Database className="w-5 h-5" />, desc: "Use your SQLite (Profile)" },
    { key: "mysql", icon: <Database className="w-5 h-5" />, desc: "Use your MySQL (Profile)" },
    { key: "pdf", icon: <FileText className="w-5 h-5" />, desc: "Upload PDF" },
    { key: "text", icon: <FileText className="w-5 h-5" />, desc: "Paste Text" },
    { key: "json", icon: <FileJson className="w-5 h-5" />, desc: "Upload JSON" },
  ];

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <Button
            key={it.key}
            variant={value === it.key ? "default" : "outline"}
            onClick={() => onChange(it.key)}
            className="justify-start"
          >
            <span className="mr-2">{it.icon}</span>
            <div className="text-left">
              <div className="font-medium">{SOURCE_LABELS[it.key]}</div>
              <div className="text-xs text-muted-foreground">{it.desc}</div>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  );
}


