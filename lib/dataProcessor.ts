// DataProcessor.ts
import {
  DataSet,
  RecordData,
  InferredFieldSchema,
  DataSchema,
  Primitive,
  DataCleaningOptions,
} from "@/lib/types";

export class DataProcessor {
 
  static applyCleaningOptions(
    dataset: DataSet,
    options: DataCleaningOptions
  ): DataSet {
    let rows = [...dataset.rows];

    if (options.removeEmptyRows) {
      rows = this.filterEmptyRows(rows);
    }

    if (options.removeDuplicates) {
      const seen = new Set<string>();
      rows = rows.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (options.trimWhitespace) {
      rows = rows.map((row) => {
        const cleaned: RecordData = {};
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === "string") {
            cleaned[key] = value.trim();
          } else {
            cleaned[key] = value;
          }
        });
        return cleaned;
      });
    }

    if (options.handleMissingValues === "remove") {
      rows = rows.filter((row) =>
        Object.values(row).every((v) => v !== null && v !== undefined)
      );
    } else if (
      options.handleMissingValues === "fill" &&
      options.fillValue !== undefined
    ) {
      const fillValue = options.fillValue;
      rows = rows.map((row) => {
        const filled: RecordData = {};
        Object.entries(row).forEach(([key, value]) => {
          filled[key] =
            value === null || value === undefined ? fillValue : value;
        });
        return filled;
      });
    }

    const schema = this.inferSchema(rows);

    return {
      ...dataset,
      schema,
      rows,
      source: {
        ...dataset.source,
        meta: {
          ...dataset.source.meta,
          cleanedAt: new Date().toISOString(),
          cleaningOptions: options,
        },
      },
    };
  }

 
  static inferSchema(rows: RecordData[]): DataSchema {
    if (!rows || rows.length === 0) {
      return { fields: [], rowCount: 0, sampleRows: [] };
    }

    const fieldMap = new Map<string, InferredFieldSchema>();

    rows.forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            name: key,
            type: "null",
            example: undefined,
            nullable: false,
          });
        }

        const field = fieldMap.get(key)!;
        const inferredType = this.inferType(value);

        if (value === null || value === undefined) {
          field.nullable = true;
        }

        if (field.type === "null" && inferredType !== "null") {
          field.type = inferredType;
          field.example = value;
        } else if (field.type !== inferredType && inferredType !== "null") {
          if (field.type !== "mixed") {
            field.type = "mixed";
          }
        }

        if (
          field.example === undefined &&
          value !== null &&
          value !== undefined
        ) {
          field.example = value;
        }
      });
    });

    const fields = Array.from(fieldMap.values());
    const sampleRows = rows.slice(0, 5);

    return {
      fields,
      rowCount: rows.length,
      sampleRows,
    };
  }

 
  private static inferType(value: Primitive): InferredFieldSchema["type"] {
    if (value === null || value === undefined) return "null";

    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";

    if (value instanceof Date) return "date";

    if (typeof value === "string") {
      if (!isNaN(Date.parse(value))) {
        return "date";
      }
      return "string";
    }

    return "string";
  }

 
  static normalizeRows(rawData: any[]): RecordData[] {
    if (!rawData || rawData.length === 0) return [];

    if (Array.isArray(rawData[0])) {
      const headers = (rawData[0] as any[]).map((h: any, i: number) =>
        h === undefined || h === null || String(h).trim() === ""
          ? `col_${i}`
          : String(h).trim()
      );

      return rawData.slice(1).map((row: any[]) => {
        const obj: RecordData = {};
        headers.forEach((header: string, i: number) => {
          obj[header] = this.cleanValue(row[i]);
        });
        return obj;
      });
    }

    if (typeof rawData[0] === "object" && rawData[0] !== null) {
      const allKeys = new Set<string>();
      rawData.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((k) => allKeys.add(String(k).trim()));
        }
      });

      return rawData.map((row) => {
        const obj: RecordData = {};
        allKeys.forEach((key) => {
          obj[key] = this.cleanValue(row ? row[key] : undefined);
        });
        return obj;
      });
    }

    return [];
  }

  
  private static cleanValue(value: any): Primitive {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;

    if (typeof value === "string") {
      value = value.trim();

      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;

      const numStr = value.replace(/,/g, "");
      if (!isNaN(Number(numStr)) && numStr !== "") {
        return Number(numStr);
      }

      const dateVal = Date.parse(value);
      if (!isNaN(dateVal)) {
        return new Date(dateVal);
      }

      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    return String(value);
  }

 
  static filterEmptyRows(rows: RecordData[]): RecordData[] {
    return rows.filter((row) =>
      Object.values(row).some((v) => v !== null && v !== undefined)
    );
  }

  
  static createDataSet(
    rawData: any[],
    sourceKind: "csv" | "excel" | "sheets",
    sourceName?: string
  ): DataSet {
    const normalized = this.normalizeRows(rawData);
    const cleaned = this.filterEmptyRows(normalized);
    const schema = this.inferSchema(cleaned);

    return {
      schema,
      rows: cleaned,
      source: {
        kind: sourceKind,
        name: sourceName,
        meta: {
          processedAt: new Date().toISOString(),
        },
      },
    };
  }

 
  static validateDataSet(dataset: any): dataset is DataSet {
    if (!dataset || typeof dataset !== "object") return false;
    if (!dataset.schema || !dataset.rows || !dataset.source) return false;
    if (!Array.isArray(dataset.rows)) return false;
    if (!Array.isArray(dataset.schema.fields)) return false;
    return true;
  }
}
