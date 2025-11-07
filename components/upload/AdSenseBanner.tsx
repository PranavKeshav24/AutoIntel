// components/AdSenseBanner.tsx
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";

type AdSenseBannerProps = {
  show: boolean;
  onClose: () => void;
};

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  show,
  onClose,
}) => {
  if (!show) return null;

  return (
    <Alert className="mb-6 bg-green-50 border-green-200">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-green-800 font-medium">
          ✓ Google AdSense authenticated successfully! You can now fetch your
          AdSense data.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};
