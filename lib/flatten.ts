export function flattenDocuments(docs: any[]) {
  const flatten = (obj: any, parent = "", res: any = {}) => {
    for (const key in obj) {
      const value = obj[key];
      const newKey = parent ? `${parent}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Convert MongoDB ObjectId -> string
        if (value.toString && value.constructor?.name === "ObjectId") {
          res[newKey] = value.toString();
        } else {
          flatten(value, newKey, res);
        }
      } else {
        res[newKey] = value;
      }
    }
    return res;
  };

  return docs.map((doc) => flatten(doc));
}
