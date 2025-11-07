// components/StatsTab.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataSet } from "@/lib/types";

type StatsTabProps = {
  dataset: DataSet;
  isSQLSource: boolean;
  dbType?: string;
  dburi?: string;
  sqlTableData?: any[];
  sqlColumns?: string[];
};

export const StatsTab: React.FC<StatsTabProps> = ({
  dataset,
  isSQLSource,
  dbType,
  dburi,
  sqlTableData = [],
  sqlColumns = [],
}) => {
  if (isSQLSource) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Database Type</p>
          <p className="text-2xl font-bold">{dbType?.toUpperCase()}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Connection Details</h3>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">URI:</span>
              <p className="text-muted-foreground break-all mt-1">{dburi}</p>
            </div>
            {sqlTableData.length > 0 && (
              <>
                <div className="text-sm">
                  <span className="font-medium">Last Query Rows:</span>
                  <p className="text-muted-foreground mt-1">
                    {sqlTableData.length}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Columns:</span>
                  <p className="text-muted-foreground mt-1">
                    {sqlColumns.length}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
        {sqlColumns.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Last Query Schema</h3>
            <div className="space-y-2">
              {sqlColumns.map((col) => (
                <div key={col} className="flex justify-between text-sm">
                  <span className="font-medium">{col}</span>
                  <Badge variant="secondary">column</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Rows</p>
          <p className="text-2xl font-bold">{dataset.schema.rowCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Columns</p>
          <p className="text-2xl font-bold">{dataset.schema.fields.length}</p>
        </Card>
      </div>
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Schema</h3>
        <div className="space-y-2">
          {dataset.schema.fields.map((field) => (
            <div key={field.name} className="flex justify-between text-sm">
              <span className="font-medium">{field.name}</span>
              <Badge variant="secondary">{field.type}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
