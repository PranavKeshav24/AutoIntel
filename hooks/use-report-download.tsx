// hooks/useReportDownload.ts
import { useState } from "react";

export const useReportDownload = () => {
  const [downloadLoading, setDownloadLoading] = useState(false);

  const downloadReport = async (
    html: string,
    format: "html" | "pdf" = "pdf"
  ) => {
    setDownloadLoading(true);
    try {
      const timestamp = Date.now();
      const baseFilename = `report-${timestamp}`;

      if (format === "html") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseFilename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const html2pdf = (await import("html2pdf.js")).default;

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-10000px";
        iframe.style.left = "-10000px";
        iframe.style.width = "1200px";
        iframe.style.height = "1000px";
        document.body.appendChild(iframe);

        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("Failed to access iframe document");

        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        await new Promise((resolve) => {
          const checkCharts = () => {
            const chartScripts = iframeDoc.querySelectorAll("script");
            let chartJsLoaded = false;

            chartScripts.forEach((script) => {
              if (script.src && script.src.includes("chart.js")) {
                chartJsLoaded = true;
              }
            });

            if (chartJsLoaded) {
              setTimeout(resolve, 3000);
            } else {
              setTimeout(resolve, 1000);
            }
          };

          if (iframeDoc.readyState === "complete") {
            checkCharts();
          } else {
            iframe.onload = checkCharts;
          }
        });

        const opt = {
          margin: [10, 10, 10, 10] as [number, number, number, number],
          filename: `${baseFilename}.pdf`,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm" as const,
            format: "a4" as const,
            orientation: "portrait" as const,
          },
          pagebreak: {
            mode: ["avoid-all", "css", "legacy"],
            before: ".page-break-before",
            after: ".page-break-after",
          },
        };

        await html2pdf().set(opt).from(iframeDoc.body).save();

        document.body.removeChild(iframe);
      }

      return { success: true, format };
    } catch (error: any) {
      console.error("Download error:", error);
      throw error;
    } finally {
      setDownloadLoading(false);
    }
  };

  return { downloadReport, downloadLoading };
};
