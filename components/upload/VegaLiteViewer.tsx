"use client";

import React, { useEffect, useRef } from "react";
import embed, { VisualizationSpec } from "vega-embed";

export function VegaLiteViewer({ spec }: { spec: VisualizationSpec }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let view: any;
    embed(ref.current, spec as any, { actions: false }).then((res) => {
      view = res.view;
    });
    return () => {
      try { view?.finalize && view.finalize(); } catch {}
    };
  }, [spec]);

  return <div ref={ref} className="w-full min-h-[360px]" />;
}


