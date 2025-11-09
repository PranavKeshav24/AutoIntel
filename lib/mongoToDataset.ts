export function mongoToDataset(docs: any[]) {
  if (!Array.isArray(docs) || docs.length === 0) {
    return {
      schema: { fields: [], rowCount: 0, sampleRows: [] },
      rows: [],
    };
  }

  // Convert ObjectId → string and fix stringified objects
  const normalized = docs.map(doc => {
    const copy = { ...doc };
    if (copy._id && typeof copy._id === "object") {
      copy._id = copy._id.toString();
    }

    for (const key in copy) {
      if (
        typeof copy[key] === "string" &&
        (copy[key].startsWith("{") || copy[key].startsWith("["))
      ) {
        try { copy[key] = JSON.parse(copy[key]); } catch {}
      }
    }

    return copy;
  });

  // Infer schema
  const first = normalized[0];
  const fields = Object.keys(first).map(key => ({
    name: key,
    type: typeof first[key],
    nullable: normalized.some(row => row[key] == null),
  }));

  return {
    schema: {
      fields,
      rowCount: normalized.length,
      sampleRows: normalized.slice(0, 5),
    },
    rows: normalized,
  };
}
