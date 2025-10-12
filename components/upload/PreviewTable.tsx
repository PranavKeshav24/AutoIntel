"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PreviewTable({ rows, columns }: { rows: any[]; columns: string[] }) {
  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <UITable>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 10).map((r, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c}>{String(r?.[c] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </UITable>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">Showing first 10 rows</div>
    </Card>
  );
}


