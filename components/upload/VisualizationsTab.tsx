// components/VisualizationsTab.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { VisualizationSpec } from "@/lib/types";
import PlotlyRenderer from "@/components/PlotlyRenderer";

type VisualizationsTabProps = {
  visualizations: VisualizationSpec[];
  selectedVizIds: Set<string>;
  vizLoading: boolean;
  onGenerateVisualizations: () => void;
  onToggleSelection: (vizId: string) => void;
};

export const VisualizationsTab: React.FC<VisualizationsTabProps> = ({
  visualizations,
  selectedVizIds,
  vizLoading,
  onGenerateVisualizations,
  onToggleSelection,
}) => {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button onClick={onGenerateVisualizations} disabled={vizLoading}>
            {vizLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Visualizations"
            )}
          </Button>
          {selectedVizIds.size > 0 && (
            <Badge variant="secondary">
              {selectedVizIds.size} selected for report
            </Badge>
          )}
        </div>
        {visualizations.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {visualizations.length} visualization
            {visualizations.length > 1 ? "s" : ""} generated
          </div>
        )}
      </div>

      {visualizations.length > 0 ? (
        <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 mt-4">
          {visualizations.map((viz) => (
            <div
              key={viz.id}
              className={`space-y-2 border-2 rounded-lg transition-all ${
                selectedVizIds.has(viz.id)
                  ? "border-primary shadow-md"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3 p-4 pb-2">
                <Checkbox
                  id={`viz-${viz.id}`}
                  checked={selectedVizIds.has(viz.id)}
                  onCheckedChange={() => onToggleSelection(viz.id)}
                  className="mt-1"
                />
                <label
                  htmlFor={`viz-${viz.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <span className="font-medium">Select for report context</span>
                  <p className="text-muted-foreground text-xs mt-1">
                    Include this visualization in generated reports
                  </p>
                </label>
              </div>

              <PlotlyRenderer
                data={viz.plotlyData}
                layout={viz.plotlyLayout}
                config={viz.plotlyConfig}
                title={viz.title}
                description={viz.description}
              />

              <div className="flex gap-2 px-4 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const spec = {
                      data: viz.plotlyData,
                      layout: viz.plotlyLayout,
                      config: viz.plotlyConfig,
                    };
                    navigator.clipboard
                      .writeText(JSON.stringify(spec, null, 2))
                      .then(() => {
                        alert("Plotly spec copied to clipboard!");
                      })
                      .catch(() => {
                        alert("Failed to copy spec to clipboard");
                      });
                  }}
                >
                  Copy Spec
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const spec = {
                      title: viz.title,
                      description: viz.description,
                      data: viz.plotlyData,
                      layout: viz.plotlyLayout,
                      config: viz.plotlyConfig,
                    };
                    const specString = JSON.stringify(spec, null, 2);
                    const blob = new Blob([specString], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${viz.id || "chart"}-plotly-spec.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Spec
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center mt-4">
          <div className="mb-4 text-muted-foreground">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground mb-2">No visualizations yet</p>
          <p className="text-sm text-muted-foreground">
            Click "Generate Visualizations" to create interactive charts
          </p>
        </div>
      )}
    </>
  );
};
