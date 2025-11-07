// components/DataSourceSelector.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataSourceType } from "@/lib/types";
import { DATA_SOURCES } from "@/lib/constants";

type DataSourceSelectorProps = {
  source: DataSourceType;
  onSourceChange: (source: DataSourceType) => void;
};

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  source,
  onSourceChange,
}) => {
  const groupedSources = DATA_SOURCES.reduce((acc, src) => {
    if (!acc[src.category]) acc[src.category] = [];
    acc[src.category].push(src);
    return acc;
  }, {} as Record<string, typeof DATA_SOURCES>);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Choose Data Source</h2>
      <div className="space-y-4">
        {Object.entries(groupedSources).map(([category, sources]) => (
          <div key={category}>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {category}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {sources.map((src: any) => {
                const Icon = src.icon;
                return (
                  <Button
                    key={src.value}
                    variant={source === src.value ? "default" : "outline"}
                    className="h-auto py-3 flex flex-col items-center gap-2"
                    onClick={() => onSourceChange(src.value)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{src.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
