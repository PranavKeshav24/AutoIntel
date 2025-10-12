"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function TextInputLoader({ onSubmit }: { onSubmit: (rows: any[], columns: string[]) => void }) {
  const [text, setText] = React.useState("");
  return (
    <Card className="p-4 space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your text here..."
        className="min-h-[160px]"
      />
      <div className="flex justify-end">
        <Button
          onClick={() => {
            const lines = text
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            const rows = lines.map((line, i) => ({ index: i + 1, text: line }));
            onSubmit(rows, ["index", "text"]);
          }}
          disabled={!text.trim()}
        >
          Load Text
        </Button>
      </div>
    </Card>
  );
}


