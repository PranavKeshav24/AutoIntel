// components/ApiKeyConfig.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

type ApiKeyConfigProps = {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onSave: () => void;
};

export const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
  apiKey,
  onApiKeyChange,
  onSave,
}) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">OpenRouter API Configuration</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <Input
            type="password"
            placeholder="sk-or-v1-..."
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
        </div>
        <Button onClick={onSave}>Save Key</Button>
      </div>
    </Card>
  );
};
