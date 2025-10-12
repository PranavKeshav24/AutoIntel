"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VegaLiteViewer } from "./VegaLiteViewer";
import type { VisualizationSpec } from "vega-embed";

export function ChartSuggestions({ specs, onRefresh }: { specs: VisualizationSpec[]; onRefresh?: () => void }) {
  if (!specs || specs.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Suggested Visualizations</div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {specs.slice(0, 4).map((spec, idx) => (
          <VegaLiteViewer key={idx} spec={spec} />
        ))}
      </div>
    </Card>
  );
}


