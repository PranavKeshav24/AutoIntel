"use client";

import React, { useEffect, useRef } from "react";
import embed, { VisualizationSpec } from "vega-embed";

type MaybeAutoIntelSpec = VisualizationSpec | { vegaLiteSpec: any };

export function VegaLiteViewer({ spec }: { spec: MaybeAutoIntelSpec }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let view: any;
    const resolved = (spec as any)?.vegaLiteSpec ? (spec as any).vegaLiteSpec : spec;
    embed(ref.current, resolved as any, { actions: false }).then((res) => {
      view = res.view;
    });
    return () => {
      try { view?.finalize && view.finalize(); } catch {}
    };
  }, [spec]);

  return <div ref={ref} className="w-full min-h-[360px]" />;
}


