import { NextRequest, NextResponse } from "next/server";
import { DataSet } from "@/lib/types";
import pptxgen from "pptxgenjs";

// Language mapping for Sarvam AI TTS
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिंदी)",
  bn: "Bengali (বাংলা)",
  te: "Telugu (తెలుగు)",
  mr: "Marathi (मराठी)",
  ta: "Tamil (தமிழ்)",
  gu: "Gujarati (ગુજરાતી)",
  kn: "Kannada (ಕನ್ನಡ)",
  ml: "Malayalam (മലയാളം)",
  pa: "Punjabi (ਪੰਜਾਬੀ)",
  or: "Odia (ଓଡ଼ିଆ)",
  as: "Assamese (অসমীয়া)",
  ur: "Urdu (اردو)",
};

// Sarvam AI language code mapping
const SARVAM_LANGUAGE_CODES: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  ur: "ur-IN",
};

// Sarvam AI speaker mapping (adjust based on available speakers)
const SARVAM_SPEAKERS: Record<string, string> = {
  en: "karun",
  hi: "karun",
  bn: "karun",
  te: "karun",
  mr: "karun",
  ta: "karun",
  gu: "karun",
  kn: "karun",
  ml: "karun",
  pa: "karun",
  or: "karun",
  as: "karun",
  ur: "karun",
};

export async function POST(request: NextRequest) {
  try {
    const {
      dataset,
      selectedVisualizations,
      selectedReports,
      config,
      reportContext,
      language = "en", // Default to English
    } = await request.json();

    if (!config?.apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    const languageName = LANGUAGE_NAMES[language] || "English";

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

IMPORTANT: Generate ALL content in ${languageName}. This includes:
- Presentation title and subtitle
- All slide titles
- All bullet points
- All speaker notes

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
1. Title slide with an engaging title and subtitle (in ${languageName})
2. Slides for each visualization with:
   - Clear slide title (in ${languageName})
   - 3-5 bullet points explaining insights (in ${languageName})
   - Speaker notes (2-3 sentences for narration, conversational tone, in ${languageName})
3. Slides for report summaries with key findings (in ${languageName})
4. Conclusion slide with actionable takeaways (in ${languageName})

Respond in JSON format:
{
  "presentationTitle": "Main Title in ${languageName}",
  "presentationSubtitle": "Subtitle in ${languageName}",
  "slides": [
    {
      "title": "Slide Title in ${languageName}",
      "content": ["Bullet point 1 in ${languageName}", "Bullet point 2 in ${languageName}", "Bullet point 3 in ${languageName}"],
      "speakerNotes": "Speaker notes in ${languageName}. Natural and conversational.",
      "visualizationId": "viz-id or null",
      "reportId": "report-id or null",
      "type": "title|content|visualization|report|conclusion"
    }
  ]
}

Make speaker notes engaging and suitable for text-to-speech. Keep them under 100 words per slide. Use natural, conversational ${languageName}.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a compelling data story presentation in ${languageName}`,
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
          model: config.model || "google/gemini-2.0-flash-exp:free",
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

    // Generate TTS audio for each slide's speaker notes with delays
    const slidesWithAudio = [];
    for (let idx = 0; idx < storyData.slides.length; idx++) {
      const slide = storyData.slides[idx];

      try {
        // Add delay between TTS requests (except for first one)
        if (idx > 0) {
          await delay(1000); // 1 second delay between requests
        }

        const audioBase64 = await generateSarvamTTS(
          slide.speakerNotes,
          language
        );
        slidesWithAudio.push({
          ...slide,
          audioData: audioBase64,
          slideNumber: idx + 1,
        });

        console.log(
          `✓ Generated ${languageName} audio for slide ${idx + 1}/${
            storyData.slides.length
          }`
        );
      } catch (error) {
        console.error(`TTS generation failed for slide ${idx + 1}:`, error);
        slidesWithAudio.push({
          ...slide,
          audioData: null,
          slideNumber: idx + 1,
        });
      }
    }

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
      language: language,
      languageName: languageName,
    });
  } catch (error: any) {
    console.error("Error in story generation API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Add delay helper for rate limiting
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate TTS using Sarvam AI
async function generateSarvamTTS(
  text: string,
  language: string = "en",
  retryCount = 0
): Promise<string> {
  const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
  const MAX_RETRIES = 2;

  if (!SARVAM_API_KEY) {
    console.warn("SARVAM_API_KEY not found in environment variables");
    return "";
  }

  try {
    // Add exponential backoff delay for retries
    if (retryCount > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
      console.log(`Waiting ${delayMs}ms before retry ${retryCount}...`);
      await delay(delayMs);
    }

    const targetLanguageCode = SARVAM_LANGUAGE_CODES[language] || "en-IN";
    const speaker = SARVAM_SPEAKERS[language] || "karun";

    console.log(
      `Trying Sarvam AI TTS for ${language} (${targetLanguageCode}) with speaker ${speaker} (attempt ${
        retryCount + 1
      })...`
    );

    // Call Sarvam AI TTS API
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.substring(0, 500), // Limit text length
        target_language_code: targetLanguageCode,
        speaker: speaker,
        pitch: 0,
        pace: 1.0,
        loudness: 1.0,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sarvam AI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Sarvam AI returns base64 audio in the response
    if (result.audios && result.audios.length > 0) {
      const base64Audio = result.audios[0];
      console.log(`✓ Sarvam AI TTS success for ${language}, audio generated`);
      return base64Audio;
    } else {
      throw new Error("No audio data in Sarvam AI response");
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.warn(`Sarvam AI TTS failed (attempt ${retryCount + 1}):`, errorMsg);

    // Retry on failure
    if (retryCount < MAX_RETRIES) {
      return generateSarvamTTS(text, language, retryCount + 1);
    }

    console.warn(
      `All TTS attempts failed for ${language}, will use browser TTS`
    );
    return "";
  }
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
  titleSlide.background = { color: "0f172a" };

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

    // Check if this slide has a visualization
    const viz = slideData.visualizationId
      ? visualizations.find((v: any) => v.id === slideData.visualizationId)
      : null;

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

    // Layout: If there's a visualization, split content and chart side-by-side
    if (viz) {
      // Left side: Content bullets
      if (slideData.content && slideData.content.length > 0) {
        const bulletText = slideData.content.map((item: string) => ({
          text: item,
          options: {
            bullet: true,
            fontSize: 14,
            color: "1e293b",
            lineSpacing: 22,
          },
        }));

        slide.addText(bulletText, {
          x: 0.5,
          y: 1.0,
          w: 4.5,
          h: 4.5,
        });
      }

      // Right side: Visualization chart
      try {
        await addChartToSlide(slide, viz, pptx, {
          x: 5.2,
          y: 1.0,
          w: 4.5,
          h: 4.5,
        });
        console.log(`✓ Added visualization to slide: ${viz.title}`);
      } catch (err) {
        console.error("Failed to add chart:", err);
        addChartPlaceholder(slide, viz, pptx, {
          x: 5.2,
          y: 1.0,
          w: 4.5,
          h: 4.5,
        });
      }
    } else {
      // No visualization - use full width for content
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
          h: 4,
        });
      }

      // Add report content if present
      if (slideData.reportId) {
        const report = reports.find((r: any) => r.id === slideData.reportId);
        if (report) {
          const reportText =
            report.summary || report.content || "Report Summary";
          slide.addText(reportText.substring(0, 500), {
            x: 0.8,
            y: 1.2,
            w: 8.4,
            h: 4,
            fontSize: 14,
            color: "334155",
            valign: "top",
          });
        }
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

// Add chart to slide with proper conversion and custom positioning
async function addChartToSlide(
  slide: any,
  viz: any,
  pptx: any,
  customPos?: { x: number; y: number; w: number; h: number }
) {
  try {
    const plotlyData = Array.isArray(viz.plotlyData)
      ? viz.plotlyData
      : [viz.plotlyData];
    const trace = plotlyData[0];

    if (!trace) {
      console.warn("No trace data found for visualization:", viz.id);
      addChartPlaceholder(slide, viz, pptx, customPos);
      return;
    }

    const chartType = (trace.type || "bar").toLowerCase();
    console.log(`Adding chart type: ${chartType} for viz: ${viz.id}`);

    // Default positioning (can be overridden)
    const pos = customPos || {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 4,
    };

    // Handle pie charts
    if (chartType === "pie") {
      const labels = trace.labels || trace.x || [];
      const values = trace.values || trace.y || [];

      if (labels.length === 0 || values.length === 0) {
        console.warn("Pie chart missing labels or values");
        addChartPlaceholder(slide, viz, pptx, customPos);
        return;
      }

      const chartData = [
        {
          name: trace.name || "Data",
          labels: labels.map((l: any) => String(l)),
          values: values.map((v: any) => Number(v) || 0),
        },
      ];

      slide.addChart(pptx.charts.PIE, chartData, {
        ...pos,
        title: viz.title || "Chart",
        showTitle: false, // Title already in slide header
        titleFontSize: 14,
        showLegend: true,
        legendPos: "r",
        legendFontSize: 10,
      });

      console.log(`✓ Added pie chart successfully at position`, pos);
      return;
    }

    // Handle bar/column charts
    if (chartType === "bar" || chartType === "column") {
      const xData = Array.isArray(trace.x) ? trace.x : [];
      const yData = Array.isArray(trace.y) ? trace.y : [];

      if (xData.length === 0 || yData.length === 0) {
        console.warn("Bar chart missing x or y data");
        addChartPlaceholder(slide, viz, pptx, customPos);
        return;
      }

      const chartData = [
        {
          name: trace.name || "Series 1",
          labels: xData.map((x: any) => String(x)),
          values: yData.map((y: any) => Number(y) || 0),
        },
      ];

      slide.addChart(pptx.charts.BAR, chartData, {
        ...pos,
        title: viz.title || "Chart",
        showTitle: false,
        titleFontSize: 14,
        showLegend: true,
        legendPos: "r",
        legendFontSize: 10,
        barDir: chartType === "column" ? "col" : "bar",
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
      });

      console.log(`✓ Added bar/column chart successfully at position`, pos);
      return;
    }

    // Handle line/scatter charts
    if (chartType === "line" || chartType === "scatter") {
      const xData = Array.isArray(trace.x) ? trace.x : [];
      const yData = Array.isArray(trace.y) ? trace.y : [];

      if (xData.length === 0 || yData.length === 0) {
        console.warn("Line chart missing x or y data");
        addChartPlaceholder(slide, viz, pptx, customPos);
        return;
      }

      const chartData = [
        {
          name: trace.name || "Series 1",
          labels: xData.map((x: any) => String(x)),
          values: yData.map((y: any) => Number(y) || 0),
        },
      ];

      slide.addChart(pptx.charts.LINE, chartData, {
        ...pos,
        title: viz.title || "Chart",
        showTitle: false,
        titleFontSize: 14,
        showLegend: true,
        legendPos: "r",
        legendFontSize: 10,
        lineSize: 2,
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
      });

      console.log(`✓ Added line/scatter chart successfully at position`, pos);
      return;
    }

    // Unsupported chart type - use placeholder
    console.warn(`Unsupported chart type: ${chartType}`);
    addChartPlaceholder(slide, viz, pptx, customPos);
  } catch (err) {
    console.error("Error adding chart to slide:", err);
    addChartPlaceholder(slide, viz, pptx, customPos);
  }
}

// Add a styled chart placeholder
function addChartPlaceholder(
  slide: any,
  viz: any,
  pptx: any,
  customPos?: { x: number; y: number; w: number; h: number }
) {
  const pos = customPos || {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 4,
  };

  slide.addShape(pptx.ShapeType.rect, {
    ...pos,
    fill: { color: "f1f5f9" },
    line: { color: "cbd5e1", width: 1 },
  });

  slide.addText("📊", {
    x: pos.x + pos.w / 2 - 0.5,
    y: pos.y + pos.h / 2 - 0.5,
    w: 1,
    h: 0.6,
    fontSize: 40,
    align: "center",
  });

  slide.addText(viz.title, {
    x: pos.x + 0.5,
    y: pos.y + pos.h / 2 + 0.2,
    w: pos.w - 1,
    h: 0.5,
    fontSize: 16,
    bold: true,
    color: "475569",
    align: "center",
  });

  slide.addText(viz.description || "Visualization", {
    x: pos.x + 0.5,
    y: pos.y + pos.h / 2 + 0.8,
    w: pos.w - 1,
    h: 0.4,
    fontSize: 12,
    color: "64748b",
    align: "center",
  });
}
