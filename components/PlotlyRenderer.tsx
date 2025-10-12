"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Image as ImageIcon, Maximize2 } from "lucide-react";

type PlotlyData = any;
type PlotlyLayout = any;
type PlotlyConfig = any;

interface PlotlyRendererProps {
  data: PlotlyData[];
  layout?: PlotlyLayout;
  config?: PlotlyConfig;
  className?: string;
  title?: string;
  description?: string;
}

export default function PlotlyRenderer({
  data,
  layout = {},
  config = {},
  className,
  title,
  description,
}: PlotlyRendererProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotly, setPlotly] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    import("plotly.js-dist-min")
      .then((Plotly) => {
        setPlotly(Plotly.default || Plotly);
      })
      .catch((err) => {
        console.error("Failed to load Plotly:", err);
        setError("Failed to load visualization library");
      });
  }, []);

  useEffect(() => {
    if (!plotly || !plotRef.current || !data) return;

    try {
      setError(null);

      // Default layout configuration
      const defaultLayout: PlotlyLayout = {
        autosize: true,
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
          family: "inherit",
          size: 12,
        },
        hovermode: "closest",
        ...layout,
      };

      // Default config
      const defaultConfig: PlotlyConfig = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
        toImageButtonOptions: {
          format: "png",
          filename: `chart-${Date.now()}`,
          height: 800,
          width: 1200,
          scale: 2,
        },
        ...config,
      };

      // Create the plot
      plotly.newPlot(plotRef.current, data, defaultLayout, defaultConfig);

      // Add hover event listener
      if (plotRef.current) {
        const plotDiv = plotRef.current as any;

        plotDiv.on("plotly_hover", (eventData: any) => {
          if (eventData.points && eventData.points[0]) {
            setHoveredData(eventData.points[0]);
          }
        });

        plotDiv.on("plotly_unhover", () => setHoveredData(null));

        plotDiv.on("plotly_click", (eventData: any) => {
          if (eventData.points && eventData.points[0]) {
            setSelectedData(eventData.points[0]);
          }
        });
      }
    } catch (err: any) {
      console.error("Plotly rendering error:", err);
      setError(err?.message || "Failed to render visualization");
    }

    // Cleanup
    return () => {
      if (plotRef.current) {
        try {
          plotly.purge(plotRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [plotly, data, layout, config]);

  const downloadImage = async (format: "png" | "svg" | "jpeg") => {
    if (!plotly || !plotRef.current) return;

    try {
      const options = {
        format,
        width: 1200,
        height: 800,
        filename: `chart-${Date.now()}`,
      };

      await plotly.downloadImage(plotRef.current, options);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download image");
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <Card className="p-6 border-destructive">
        <div className="flex items-start gap-3">
          <div className="text-destructive">⚠</div>
          <div>
            <h4 className="font-semibold text-destructive mb-1">
              Visualization Error
            </h4>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!plotly) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          <span>Loading visualization...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className={className || ""}>
      <Card className="px-4 pt-4 border-none shadow-none ">
        {(title || description) && (
          <div className="mb-4">
            {title && <h3 className="text-lg font-semibold mb-1">{title}</h3>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        <div
          className={`relative ${
            isFullscreen
              ? "fixed inset-0 z-50 bg-background p-8"
              : "w-full h-[400px]"
          }`}
        >
          <div ref={plotRef} className="w-full h-full" />

          {/* Fullscreen toggle */}
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 z-10"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadImage("png")}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadImage("svg")}
          >
            <Download className="h-4 w-4 mr-2" />
            SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadImage("jpeg")}
          >
            <Download className="h-4 w-4 mr-2" />
            JPEG
          </Button>
        </div>

        {/* Data Display */}
        {/* {(hoveredData || selectedData) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {hoveredData && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">
                  Hovered Point
                </h4>
                <div className="space-y-1 text-xs">
                  {hoveredData.x !== undefined && (
                    <div>
                      <span className="font-medium">X:</span> {hoveredData.x}
                    </div>
                  )}
                  {hoveredData.y !== undefined && (
                    <div>
                      <span className="font-medium">Y:</span> {hoveredData.y}
                    </div>
                  )}
                  {hoveredData.z !== undefined && (
                    <div>
                      <span className="font-medium">Z:</span> {hoveredData.z}
                    </div>
                  )}
                  {hoveredData.text && (
                    <div>
                      <span className="font-medium">Label:</span>{" "}
                      {hoveredData.text}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {selectedData && (
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-green-900 text-sm">
                    Selected Point
                  </h4>
                  <button
                    onClick={() => setSelectedData(null)}
                    className="text-green-700 hover:text-green-900 text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  {selectedData.x !== undefined && (
                    <div>
                      <span className="font-medium">X:</span> {selectedData.x}
                    </div>
                  )}
                  {selectedData.y !== undefined && (
                    <div>
                      <span className="font-medium">Y:</span> {selectedData.y}
                    </div>
                  )}
                  {selectedData.z !== undefined && (
                    <div>
                      <span className="font-medium">Z:</span> {selectedData.z}
                    </div>
                  )}
                  {selectedData.text && (
                    <div>
                      <span className="font-medium">Label:</span>{" "}
                      {selectedData.text}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )} */}
      </Card>
    </div>
  );
}
