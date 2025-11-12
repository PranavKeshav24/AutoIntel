import {
  ObjectId,
  Decimal128,
  Long,
  Double,
  Int32,
} from "mongodb";

/** Normalize scalar & BSON values */
function normalizeScalar(value: any): any {
  if (value == null) return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Decimal128) return Number(value.toString());
  if (value instanceof Long) return value.toNumber();
  if (value instanceof Double) return Number(value.valueOf());
  if (value instanceof Int32) return Number(value.valueOf());

  return value;
}

/** Normalize embedded objects *without* deep flattening */
function normalizeObjectShallow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const scalar = normalizeScalar(v);
    if (scalar !== v) {
      out[k] = scalar;
    } else if (Array.isArray(v)) {
      out[k] = v.map(normalizeScalar);
    } else if (v && typeof v === "object") {
      // Keep object, but normalize its internal scalars
      const inner: Record<string, any> = {};
      for (const [ik, iv] of Object.entries(v)) {
        inner[ik] = normalizeScalar(iv);
      }
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Flatten only one level: parent.child = value */
function flattenOneLevel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      let expanded = false;
      for (const [k2, v2] of Object.entries(value)) {
        out[`${key}.${k2}`] = normalizeScalar(v2);
        expanded = true;
      }
      if (!expanded) out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Fully normalize a document */
function normalizeDoc(doc: any): Record<string, any> {
  const base = normalizeObjectShallow(doc);
  return flattenOneLevel(base);
}

/** Infer field type from multiple rows */
function inferFieldType(values: any[]): string {
  const filtered = values.filter(v => v !== null && v !== undefined);

  if (filtered.length === 0) return "null";

  const types = new Set(filtered.map(v => {
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return "date";
      return "string";
    }
    if (typeof v === "number") return "number";
    if (typeof v === "boolean") return "boolean";
    if (Array.isArray(v)) return "array";
    if (typeof v === "object") return "object";
    return "mixed";
  }));

  if (types.size === 1) return Array.from(types)[0];
  return "mixed";
}

export default function mongoToDataset(docs: any[]) {
  if (!docs || docs.length === 0) {
    return { schema: { fields: [] }, rows: [], sampleRows: [] };
  }

  const normalizedRows = docs.map(normalizeDoc);

  const fieldNames = new Set<string>();
  normalizedRows.forEach(r => Object.keys(r).forEach(k => fieldNames.add(k)));

  const fields = Array.from(fieldNames).map(name => ({
    name,
    type: inferFieldType(normalizedRows.map(r => r[name]))
  }));

  const sampleRows = normalizedRows.slice(0, Math.min(10, Math.max(5, normalizedRows.length)));

  return {
    schema: { fields },
    rows: normalizedRows,
    sampleRows
  };
}
