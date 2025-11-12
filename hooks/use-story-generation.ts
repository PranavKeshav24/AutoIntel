// hooks/useStoryGeneration.ts
import { useState } from "react";
import { generateVisualizationImages } from "@/utils/chartImageGenerator";

interface StoryGenerationOptions {
  dataset: any;
  selectedVisualizations: any[];
  selectedReports: any[];
  config: any;
  reportContext?: string;
  language?: string;
}

interface StoryResult {
  presentationTitle: string;
  presentationSubtitle: string;
  slides: any[];
  pptxData: string;
  language: string;
  languageName: string;
}

export function useStoryGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const generateStory = async (
    options: StoryGenerationOptions
  ): Promise<StoryResult | null> => {
    setLoading(true);
    setError(null);
    setProgress("Preparing visualizations...");

    try {
      // Step 1: Generate images for all selected visualizations
      const visualizationImages: Record<string, string> = {};

      if (
        options.selectedVisualizations &&
        options.selectedVisualizations.length > 0
      ) {
        setProgress(
          `Generating images for ${options.selectedVisualizations.length} visualizations...`
        );

        for (let i = 0; i < options.selectedVisualizations.length; i++) {
          const viz = options.selectedVisualizations[i];
          try {
            setProgress(
              `Converting visualization ${i + 1}/${
                options.selectedVisualizations.length
              }: ${viz.title}`
            );

            // Import Plotly dynamically
            const Plotly = await import("plotly.js-dist-min");

            // Create temporary container
            const tempDiv = document.createElement("div");
            tempDiv.style.width = "1200px";
            tempDiv.style.height = "600px";
            tempDiv.style.position = "absolute";
            tempDiv.style.left = "-9999px";
            document.body.appendChild(tempDiv);

            // Configure layout for image export
            const imageLayout = {
              ...viz.plotlyLayout,
              width: 1200,
              height: 600,
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              font: {
                size: 14,
                family: "Arial, sans-serif",
              },
            };

            // Create the plot
            await Plotly.default.newPlot(tempDiv, viz.plotlyData, imageLayout, {
              staticPlot: true,
              displayModeBar: false,
            });

            // Convert to image
            const imageDataUrl = await Plotly.default.toImage(tempDiv, {
              format: "png",
              width: 1200,
              height: 600,
              scale: 2,
            });

            // Clean up
            Plotly.default.purge(tempDiv);
            document.body.removeChild(tempDiv);

            // Extract base64 from data URL
            const base64 = imageDataUrl.split(",")[1];
            visualizationImages[viz.id] = base64;

            console.log(`✓ Generated image for: ${viz.title}`);
          } catch (err) {
            console.error(`Failed to generate image for ${viz.title}:`, err);
            // Continue with other visualizations
          }
        }

        setProgress(
          `Generated ${
            Object.keys(visualizationImages).length
          } visualization images`
        );
      }

      // Step 2: Call the story generation API
      setProgress("Generating story content and narration...");

      const response = await fetch("/api/llm/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...options,
          visualizationImages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate story");
      }

      const result: StoryResult = await response.json();

      setProgress("Story generated successfully!");
      setLoading(false);

      return result;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to generate story";
      setError(errorMessage);
      setProgress("");
      setLoading(false);
      console.error("Story generation error:", err);
      return null;
    }
  };

  return {
    generateStory,
    loading,
    error,
    progress,
  };
}
