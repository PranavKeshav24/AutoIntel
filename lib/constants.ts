// constants.ts - Configuration constants
import {
  FileSpreadsheet,
  LinkIcon,
  FileJson,
  FileText,
  Database,
  MessageSquare,
  DollarSign,
} from "lucide-react";
import { DataSourceType } from "@/lib/types";

export const DATA_SOURCES: {
  value: DataSourceType;
  label: string;
  icon: any;
  category: string;
}[] = [
  { value: "csv", label: "CSV File", icon: FileSpreadsheet, category: "Files" },
  { value: "excel", label: "Excel", icon: FileSpreadsheet, category: "Files" },
  {
    value: "sheets",
    label: "Google Sheets",
    icon: LinkIcon,
    category: "Files",
  },
  { value: "json", label: "JSON", icon: FileJson, category: "Files" },
  { value: "text", label: "Text File", icon: FileText, category: "Files" },
  { value: "pdf", label: "PDF", icon: FileText, category: "Files" },
  {
    value: "postgresql",
    label: "PostgreSQL",
    icon: Database,
    category: "Databases",
  },
  { value: "mysql", label: "MySQL", icon: Database, category: "Databases" },
  { value: "sqlite", label: "SQLite", icon: Database, category: "Databases" },
  { value: "mongodb", label: "MongoDB", icon: Database, category: "Databases" },
  { value: "reddit", label: "Reddit", icon: MessageSquare, category: "APIs" },
  {
    value: "adsense",
    label: "Google AdSense",
    icon: DollarSign,
    category: "APIs",
  },
];
