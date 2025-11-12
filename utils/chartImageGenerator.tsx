import Plotly from "plotly.js-dist-min";

/**
 * Convert Plotly chart to base64 PNG image
 * This runs on the client side where Plotly has full DOM access
 */
export async function plotlyToBase64Image(
  plotlyData: any[],
  plotlyLayout: any = {},
  width: number = 1200,
  height: number = 600
): Promise<string> {
  try {
    // Create a temporary container
    const tempDiv = document.createElement("div");
    tempDiv.style.width = `${width}px`;
    tempDiv.style.height = `${height}px`;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);

    // Configure layout for image export
    const imageLayout = {
      ...plotlyLayout,
      width,
      height,
      paper_bgcolor: "white",
      plot_bgcolor: "white",
    };

    // Create the plot
    await Plotly.newPlot(tempDiv, plotlyData, imageLayout, {
      staticPlot: true,
      displayModeBar: false,
    });

    // Convert to image
    const imageDataUrl = await Plotly.toImage(tempDiv, {
      format: "png",
      width,
      height,
      scale: 2,
    });

    // Clean up
    Plotly.purge(tempDiv);
    document.body.removeChild(tempDiv);

    // Extract base64 from data URL (remove "data:image/png;base64," prefix)
    const base64 = imageDataUrl.split(",")[1];
    return base64;
  } catch (error) {
    console.error("Failed to convert Plotly chart to image:", error);
    throw error;
  }
}

/**
 * Generate images for multiple visualizations
 */
export async function generateVisualizationImages(
  visualizations: Array<{
    id: string;
    plotlyData: any[];
    plotlyLayout?: any;
  }>
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  for (const viz of visualizations) {
    try {
      const base64Image = await plotlyToBase64Image(
        viz.plotlyData,
        viz.plotlyLayout
      );
      imageMap.set(viz.id, base64Image);
      console.log(`✓ Generated image for visualization: ${viz.id}`);
    } catch (error) {
      console.error(`Failed to generate image for viz ${viz.id}:`, error);
      // Continue with other visualizations even if one fails
    }
  }

  return imageMap;
}
