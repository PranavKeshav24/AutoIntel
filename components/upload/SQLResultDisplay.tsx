// components/SQLResultDisplay.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code, Copy, Check } from "lucide-react";
import { Message } from "@/lib/types";

type SQLResultDisplayProps = {
  sqlData: Message["sqlData"];
};

export const SQLResultDisplay: React.FC<SQLResultDisplayProps> = ({
  sqlData,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);

  if (!sqlData) return null;

  const copySQL = () => {
    navigator.clipboard.writeText(sqlData.generated_sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const columns =
    sqlData.results.length > 0 ? Object.keys(sqlData.results[0]) : [];
  const rows = sqlData.results;

  return (
    <div className="mt-3 space-y-3 max-w-xs">
      {/* Question */}
      <div className="border-2 rounded-lg p-3">
        <p className="text-xs font-semibold text-black dark:text-white">
          Question:
        </p>
        <p className="text-sm text-black dark:text-white">{sqlData.question}</p>
      </div>

      {/* Generated SQL */}
      <div className="border-2 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Code className="h-3 w-3 text-gray-600" />
            <p className="text-xs font-semibold text-black dark:text-white">
              Generated SQL
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copySQL}
            className="h-6 px-2"
          >
            {copiedSql ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
        <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded border-2 overflow-x-auto">
          <code className="text-black dark:text-gray-200">
            {sqlData.generated_sql}
          </code>
        </pre>
      </div>

      {/* Results Table */}
      <div className="border-2 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-2">
          <p className="text-xs font-semibold text-black dark:text-white">
            Results ({rows.length} row{rows.length !== 1 ? "s" : ""})
          </p>
        </div>
        <div className="max-h-64 overflow-auto">
          {rows.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold text-black dark:text-white border-b border-2"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, idx: any) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-none" : "bg-none"}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-black dark:text-white border-b-2"
                      >
                        {row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              No results returned
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
