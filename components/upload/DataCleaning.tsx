"use client";

import React from "react";
import { DataCleaningOptions } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

interface DataCleaningProps {
  options: DataCleaningOptions;
  onChange: (options: DataCleaningOptions) => void;
  onApply: () => void;
  disabled?: boolean;
}

export function DataCleaning({
  options,
  onChange,
  onApply,
  disabled,
}: DataCleaningProps) {
  const updateOption = <K extends keyof DataCleaningOptions>(
    key: K,
    value: DataCleaningOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Data Cleaning Options</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="remove-empty" className="flex-1">
            Remove Empty Rows
          </Label>
          <Switch
            id="remove-empty"
            checked={options.removeEmptyRows}
            onCheckedChange={(checked) =>
              updateOption("removeEmptyRows", checked)
            }
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="remove-dupes" className="flex-1">
            Remove Duplicate Rows
          </Label>
          <Switch
            id="remove-dupes"
            checked={options.removeDuplicates}
            onCheckedChange={(checked) =>
              updateOption("removeDuplicates", checked)
            }
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="trim-whitespace" className="flex-1">
            Trim Whitespace
          </Label>
          <Switch
            id="trim-whitespace"
            checked={options.trimWhitespace}
            onCheckedChange={(checked) =>
              updateOption("trimWhitespace", checked)
            }
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Handle Missing Values</Label>
          <Select
            value={options.handleMissingValues}
            onValueChange={(value: any) =>
              updateOption("handleMissingValues", value)
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep as null</SelectItem>
              <SelectItem value="remove">Remove rows with nulls</SelectItem>
              <SelectItem value="fill">Fill with value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {options.handleMissingValues === "fill" && (
          <div className="space-y-2">
            <Label>Fill Value</Label>
            <Input
              placeholder="Enter fill value (e.g., 0, N/A)"
              value={options.fillValue || ""}
              onChange={(e) => updateOption("fillValue", e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        <Button onClick={onApply} disabled={disabled} className="w-full">
          Apply Cleaning
        </Button>
      </div>
    </Card>
  );
}
