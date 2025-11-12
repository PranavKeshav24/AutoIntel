import { NextRequest, NextResponse } from "next/server";
import { DataSet } from "@/lib/types";
import pptxgen from "pptxgenjs";

export async function POST(request: NextRequest) {
  try {
    const {
      dataset,
      selectedVisualizations,
      selectedReports,
      config,
      reportContext,
    } = await request.json();

    if (!config?.apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    // Prepare context for LLM
    const schemaSummary =
      dataset?.schema?.fields
        ?.map((f: any) => `- ${f.name} (${f.type})`)
        .join("\n") || "No schema available";

    const vizContext =
      selectedVisualizations
        ?.map(
          (viz: any, idx: number) =>
            `Visualization ${idx + 1}: ${viz.title}\n${viz.description}`
        )
        .join("\n\n") || "";

    const reportContext_text =
      selectedReports
        ?.map(
          (report: any, idx: number) =>
            `Report ${idx + 1}: ${report.title || "Analysis Report"}\n${
              report.summary || report.content?.substring(0, 500)
            }`
        )
        .join("\n\n") || "";

    const systemPrompt = `You are a data storytelling expert. Create an engaging presentation story based on the provided data, visualizations, and reports.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset?.schema?.rowCount || 0}

Visualizations:
${vizContext}

Reports:
${reportContext_text}

User Context:
${reportContext || "No additional context"}

Generate a compelling presentation with:
1. Title slide with an engaging title and subtitle
2. Slides for each visualization with:
   - Clear slide title
   - 3-5 bullet points explaining insights
   - Speaker notes (2-3 sentences for narration, conversational tone)
3. Slides for report summaries with key findings
4. Conclusion slide with actionable takeaways

Respond in JSON format:
{
  "presentationTitle": "Main Title",
  "presentationSubtitle": "Subtitle",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "speakerNotes": "This slide shows... The key insight is...",
      "visualizationId": "viz-id or null",
      "reportId": "report-id or null",
      "type": "title|content|visualization|report|conclusion"
    }
  ]
}

Make speaker notes engaging and suitable for text-to-speech. Keep them under 100 words per slide.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "Generate a compelling data story presentation",
      },
    ];

    // Call OpenRouter API
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.referer || "https://your-app.com",
          "X-Title": config.title || "Data Analysis App",
        },
        body: JSON.stringify({
          model: config.model || "meta-llama/llama-4-maverick:free",
          messages,
          temperature: 0.8,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)```/) ||
      content.match(/```\s*([\s\S]*?)```/) ||
      content.match(/\{[\s\S]*\}/);

    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
    let storyData: any;

    try {
      storyData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse story JSON:", e);
      throw new Error("Failed to generate story structure");
    }

    // Generate TTS audio for each slide's speaker notes
    const slidesWithAudio = await Promise.all(
      storyData.slides.map(async (slide: any, idx: number) => {
        try {
          const audioBase64 = await generateTTS(slide.speakerNotes);
          return {
            ...slide,
            audioData: audioBase64,
            slideNumber: idx + 1,
          };
        } catch (error) {
          console.error(`TTS generation failed for slide ${idx + 1}:`, error);
          return {
            ...slide,
            audioData: null,
            slideNumber: idx + 1,
          };
        }
      })
    );

    // Create PowerPoint presentation
    const pptxData = await createPowerPoint(
      storyData,
      selectedVisualizations || [],
      selectedReports || []
    );

    return NextResponse.json({
      presentationTitle: storyData.presentationTitle,
      presentationSubtitle: storyData.presentationSubtitle,
      slides: slidesWithAudio,
      pptxData: pptxData,
    });
  } catch (error: any) {
    console.error("Error in story generation API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Generate TTS using multiple fallback options
async function generateTTS(text: string): Promise<string> {
  const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

  // Try HuggingFace TTS with proper error handling
  if (HF_TOKEN) {
    const endpoints = [
      {
        model: "hexgrad/Kokoro-82M",
        url: "https://router.huggingface.co/fal-ai/fal-ai/kokoro/american-english",
      },
      {
        model: "ResembleAI/chatterbox",
        url: "https://router.huggingface.co/fal-ai/fal-ai/chatterbox/text-to-speech",
      },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying TTS with ${endpoint.model}...`);

        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: text,
            options: {
              wait_for_model: true,
            },
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");

          // Check if response is audio
          if (
            contentType?.includes("audio") ||
            contentType?.includes("application/octet-stream")
          ) {
            const audioBuffer = await response.arrayBuffer();
            const base64Audio = Buffer.from(audioBuffer).toString("base64");
            console.log(
              `✓ TTS success with ${endpoint.model}, audio size: ${audioBuffer.byteLength} bytes`
            );
            return base64Audio;
          } else {
            console.warn(
              `${endpoint.model} returned non-audio response:`,
              contentType
            );
          }
        } else {
          const errorText = await response.text();
          console.warn(
            `${endpoint.model} failed with status ${response.status}:`,
            errorText
          );
        }
      } catch (err: any) {
        console.warn(`${endpoint.model} error:`, err.message);
        continue;
      }
    }
  } else {
    console.warn("HUGGINGFACE_API_KEY not found in environment variables");
  }

  // Try ElevenLabs if available
  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
  if (ELEVENLABS_KEY) {
    try {
      console.log("Trying ElevenLabs TTS...");
      const response = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log(
          `✓ ElevenLabs TTS success, audio size: ${audioBuffer.byteLength} bytes`
        );
        return Buffer.from(audioBuffer).toString("base64");
      }
    } catch (err: any) {
      console.warn("ElevenLabs TTS failed:", err.message);
    }
  }

  // Try Google Cloud TTS
  const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
  if (GOOGLE_API_KEY) {
    try {
      console.log("Trying Google Cloud TTS...");
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: "en-US",
              name: "en-US-Neural2-J",
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: 1.0,
              pitch: 0.0,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✓ Google Cloud TTS success");
        return data.audioContent;
      }
    } catch (err: any) {
      console.warn("Google TTS failed:", err.message);
    }
  }

  console.warn("All TTS services failed, will use browser TTS");
  return "";
}

// Create PowerPoint presentation with proper charts
async function createPowerPoint(
  storyData: any,
  visualizations: any[],
  reports: any[]
): Promise<string> {
  const pptx = new pptxgen();

  pptx.author = "AutoIntel";
  pptx.title = storyData.presentationTitle;
  pptx.subject = "Data Story Presentation";
  pptx.layout = "LAYOUT_16x9";

  // Title Slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "0f172a" }; // slate-900

  titleSlide.addText(storyData.presentationTitle, {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 1.5,
    fontSize: 44,
    bold: true,
    color: "FFFFFF",
    align: "center",
  });

  titleSlide.addText(storyData.presentationSubtitle, {
    x: 0.5,
    y: 4,
    w: 9,
    h: 0.8,
    fontSize: 24,
    color: "cbd5e1",
    align: "center",
  });

  titleSlide.addText("Generated by AutoIntel", {
    x: 0.5,
    y: 5.2,
    w: 9,
    h: 0.4,
    fontSize: 14,
    color: "94a3b8",
    align: "center",
    italic: true,
  });

  // Content Slides
  for (const slideData of storyData.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Add header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.6,
      fill: { color: "3b82f6" },
    });

    // Add title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.1,
      w: 9,
      h: 0.5,
      fontSize: 28,
      bold: true,
      color: "FFFFFF",
    });

    // Add content bullets
    if (slideData.content && slideData.content.length > 0) {
      const bulletText = slideData.content.map((item: string) => ({
        text: item,
        options: {
          bullet: true,
          fontSize: 18,
          color: "1e293b",
          lineSpacing: 28,
        },
      }));

      slide.addText(bulletText, {
        x: 0.8,
        y: 1.2,
        w: 8.4,
        h: 3,
      });
    }

    // Add visualization chart
    if (slideData.visualizationId) {
      const viz = visualizations.find(
        (v: any) => v.id === slideData.visualizationId
      );

      if (viz) {
        try {
          await addChartToSlide(slide, viz, pptx);
        } catch (err) {
          console.error("Failed to add chart:", err);
          addChartPlaceholder(slide, viz, pptx);
        }
      }
    }

    // Add report content
    if (slideData.reportId) {
      const report = reports.find((r: any) => r.id === slideData.reportId);
      if (report) {
        const reportText = report.summary || report.content || "Report Summary";
        slide.addText(reportText.substring(0, 500), {
          x: 0.8,
          y: 4.2,
          w: 8.4,
          h: 2.5,
          fontSize: 14,
          color: "334155",
          valign: "top",
        });
      }
    }

    // Add speaker notes
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }

    // Add footer
    slide.addText(`Slide ${slideData.slideNumber || 1}`, {
      x: 8.5,
      y: 5.3,
      w: 1,
      h: 0.3,
      fontSize: 10,
      color: "94a3b8",
      align: "right",
    });
  }

  // Generate PPTX as base64
  const pptxBlob = await pptx.write({ outputType: "base64" });
  return pptxBlob as string;
}

// Add chart to slide with proper conversion
async function addChartToSlide(slide: any, viz: any, pptx: any) {
  const plotlyData = Array.isArray(viz.plotlyData)
    ? viz.plotlyData
    : [viz.plotlyData];
  const trace = plotlyData[0];

  if (!trace || !trace.x || !trace.y) {
    addChartPlaceholder(slide, viz, pptx);
    return;
  }

  const chartType = trace.type || "bar";

  // Convert to PptxGenJS format
  if (chartType === "pie") {
    const chartData = [
      {
        name: trace.name || "Data",
        labels: trace.labels || [],
        values: trace.values || [],
      },
    ];

    slide.addChart(pptx.charts.PIE, chartData, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 3,
      title: viz.title,
      showTitle: true,
      titleFontSize: 14,
      showLegend: true,
      legendPos: "r",
    });
  } else if (chartType === "bar" || chartType === "column") {
    const chartData = [
      {
        name: trace.name || "Series 1",
        labels: Array.isArray(trace.x) ? trace.x : [],
        values: Array.isArray(trace.y) ? trace.y : [],
      },
    ];

    slide.addChart(pptx.charts.BAR, chartData, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 3,
      title: viz.title,
      showTitle: true,
      titleFontSize: 14,
      showLegend: true,
      legendPos: "r",
      barDir: chartType === "bar" ? "bar" : "col",
    });
  } else if (chartType === "line" || chartType === "scatter") {
    const chartData = [
      {
        name: trace.name || "Series 1",
        labels: Array.isArray(trace.x) ? trace.x : [],
        values: Array.isArray(trace.y) ? trace.y : [],
      },
    ];

    slide.addChart(pptx.charts.LINE, chartData, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 3,
      title: viz.title,
      showTitle: true,
      titleFontSize: 14,
      showLegend: true,
      legendPos: "r",
    });
  } else {
    addChartPlaceholder(slide, viz, pptx);
  }
}

// Add a styled chart placeholder
function addChartPlaceholder(slide: any, viz: any, pptx: any) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 4.2,
    w: 9,
    h: 3,
    fill: { color: "f1f5f9" },
    line: { color: "cbd5e1", width: 1 },
  });

  slide.addText("📊", {
    x: 4.5,
    y: 4.8,
    w: 1,
    h: 0.6,
    fontSize: 40,
    align: "center",
  });

  slide.addText(viz.title, {
    x: 1,
    y: 5.5,
    w: 8,
    h: 0.5,
    fontSize: 16,
    bold: true,
    color: "475569",
    align: "center",
  });

  slide.addText(viz.description || "Visualization", {
    x: 1,
    y: 6.1,
    w: 8,
    h: 0.4,
    fontSize: 12,
    color: "64748b",
    align: "center",
  });
}
