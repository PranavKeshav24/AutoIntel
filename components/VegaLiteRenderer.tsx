"use client";

import React, { useEffect, useRef, useState } from "react";

type VegaLiteSpec = Record<string, any>;

export default function VegaLiteRenderer({
  spec,
  actions = { export: true, source: false, compiled: false },
  renderer = "canvas",
  className,
}: {
  spec: VegaLiteSpec;
  actions?: Record<string, any>;
  renderer?: "canvas" | "svg";
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [embedResult, setEmbedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [selectedData, setSelectedData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    let view: any = null;

    async function mount() {
      if (!elRef.current) return;
      setError(null);

      try {
        const mod = await import("vega-embed");
        const embed: any = (mod && (mod.default || mod)) as any;

        const opts = {
          renderer,
          actions,
          tooltip: true,
        };

        const r = await embed(elRef.current, spec, opts);
        if (cancelled) {
          try {
            r?.view?.finalize?.();
          } catch {}
          return;
        }
        view = r.view;

        // Add hover listeners for interactivity
        view.addEventListener("mouseover", (event: any, item: any) => {
          if (item && item.datum) {
            setHoveredData(item.datum);
          }
        });

        view.addEventListener("mouseout", () => {
          setHoveredData(null);
        });

        // Add click listeners for selection
        view.addEventListener("click", (event: any, item: any) => {
          if (item && item.datum) {
            setSelectedData(item.datum);
          }
        });

        setEmbedResult(r);
      } catch (err: any) {
        console.error("vega-embed error", err);
        setError(String(err?.message || err));
      }
    }

    mount();

    return () => {
      cancelled = true;
      try {
        view?.finalize?.();
      } catch {}
    };
  }, [spec, renderer, actions]);

  const downloadImage = async (type: "png" | "svg") => {
    try {
      const view = embedResult?.view;
      if (!view) throw new Error("Visualization not ready");
      const url = await view.toImageURL(type === "svg" ? "svg" : "png");
      const a = document.createElement("a");
      a.href = url;
      const ext = type === "svg" ? "svg" : "png";
      a.download = `viz-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Failed to download image: " + String(err));
    }
  };

  return (
    <div className={className || ""}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error rendering visualization: {error}
        </div>
      )}

      <div ref={elRef} />

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => downloadImage("png")}
          className="px-3 py-1 rounded border text-sm"
        >
          Download PNG
        </button>
        <button
          onClick={() => downloadImage("svg")}
          className="px-3 py-1 rounded border text-sm"
        >
          Download SVG
        </button>
      </div>

      {(hoveredData || selectedData) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {hoveredData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Hovered Data</h3>
              <pre className="text-xs overflow-auto max-h-32 bg-white p-2 rounded">
                {JSON.stringify(hoveredData, null, 2)}
              </pre>
            </div>
          )}

          {selectedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-green-900">Selected Data</h3>
                <button
                  onClick={() => setSelectedData(null)}
                  className="text-green-700 hover:text-green-900 text-sm"
                >
                  ✕
                </button>
              </div>
              <pre className="text-xs overflow-auto max-h-32 bg-white p-2 rounded">
                {JSON.stringify(selectedData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
