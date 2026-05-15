import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDocx, { type DocxOptions } from "remark-docx";
import { latexPlugin } from "remark-docx/plugins/latex";
import { preprocessAIOutput } from "./parse";

// No page-break, compact sizes. All sizes in half-points (24 = 12pt, 28 = 14pt, etc.)
const noBreak = { pageBreakBefore: false, keepNext: false };

const docxOptions: DocxOptions = {
  // --- thematic break: --- becomes a horizontal rule, NOT a page break
  thematicBreak: "line",
  styles: {
    default: {
      document: {
        run: { size: 26, font: "Calibri" },          // 13pt body text
        paragraph: { spacing: { after: 120 } },
      },
      title: {                                        // # H1
        run: { size: 36, bold: true, color: "1F2937" },
        paragraph: { ...noBreak, spacing: { before: 240, after: 160 } },
      },
      heading1: {                                     // ## H2
        run: { size: 30, bold: true, color: "1F2937" },
        paragraph: { ...noBreak, spacing: { before: 280, after: 120 } },
      },
      heading2: {                                     // ### H3
        run: { size: 28, bold: true, color: "374151" },
        paragraph: { ...noBreak, spacing: { before: 240, after: 100 } },
      },
      heading3: {                                     // #### H4
        run: { size: 26, bold: true, color: "4B5563" },
        paragraph: { ...noBreak, spacing: { before: 200, after: 80 } },
      },
      heading4: {
        run: { size: 26, bold: true, italics: true, color: "4B5563" },
        paragraph: { ...noBreak, spacing: { before: 160, after: 80 } },
      },
      heading5: {
        run: { size: 26, bold: false, italics: true, color: "6B7280" },
        paragraph: { ...noBreak, spacing: { before: 120, after: 60 } },
      },
    },
  } as DocxOptions["styles"],
  plugins: [
    latexPlugin(),
  ],
};

export async function generateDocxBuffer(markdown: string): Promise<ArrayBuffer> {
  try {
    const preprocessed = preprocessAIOutput(markdown);

    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDocx, docxOptions)
      .process(preprocessed);

    return (await file.result) as ArrayBuffer;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[generateDocxBuffer] error:", err);
    throw new Error(msg);
  }
}

export function saveBufferAsDocx(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
