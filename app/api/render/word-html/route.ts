import { NextRequest, NextResponse } from "next/server";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeMathjaxSvg from "rehype-mathjax/svg";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";
import { preprocessAIOutput } from "@/lib/markdown/parse";

export const maxDuration = 30;

/**
 * A rehype plugin that converts every inline <svg> element produced by
 * rehype-mathjax into an <img src="data:image/svg+xml;base64,..."> tag.
 *
 * Why: ONLYOFFICE and LibreOffice strip bare <svg> nodes from pasted HTML,
 * but they fully support <img> elements with SVG data-URIs.
 * Word, Google Docs and every other office app also handles <img> perfectly.
 */
function rehypeSvgToImg() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "svg" || !parent || index == null) return;

      // Serialise the SVG back to a string so we can base64-encode it
      const serialised = svgElementToString(node);
      const b64 = Buffer.from(serialised).toString("base64");
      const src = `data:image/svg+xml;base64,${b64}`;

      // Read dimensions from the SVG attributes for sizing hints
      const width  = (node.properties?.width  as string | undefined) ?? "";
      const height = (node.properties?.height as string | undefined) ?? "";
      const style  = (node.properties?.style  as string | undefined) ?? "";

      // Replace the <svg> with an <img>
      const img: Element = {
        type: "element",
        tagName: "img",
        properties: {
          src,
          alt: "equation",
          // Keep ex-based dimensions so equations scale with the surrounding text
          style: `height:${height};${style}`,
        },
        children: [],
      };

      parent.children[index] = img;
    });
  };
}

/** Minimal recursive SVG serialiser (no external dependency needed). */
function svgElementToString(node: Element): string {
  const attrs = Object.entries(node.properties ?? {})
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(" ");

  const open = attrs ? `<${node.tagName} ${attrs}>` : `<${node.tagName}>`;

  const children = (node.children ?? [])
    .map((child) => {
      if (child.type === "element") return svgElementToString(child as Element);
      if (child.type === "text")    return (child as { type: "text"; value: string }).value;
      return "";
    })
    .join("");

  return `${open}${children}</${node.tagName}>`;
}

export async function POST(req: NextRequest) {
  try {
    const { markdown } = await req.json();
    if (!markdown) {
      return NextResponse.json({ error: "Markdown is required" }, { status: 400 });
    }

    const preprocessed = preprocessAIOutput(markdown);

    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeMathjaxSvg)   // math → inline <svg>
      .use(rehypeSvgToImg)     // inline <svg> → <img data-uri> (compatible with all office apps)
      .use(rehypeStringify)
      .process(preprocessed);

    const body = String(file);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 13pt; line-height: 1.5; }
  h1 { font-size: 20pt; font-weight: bold; margin: 16pt 0 8pt; }
  h2 { font-size: 16pt; font-weight: bold; margin: 14pt 0 6pt; }
  h3 { font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt; }
  p  { margin: 6pt 0; }
  ul, ol { margin: 4pt 0 4pt 24pt; }
  li { margin: 2pt 0; }
  img { vertical-align: middle; }
  code { font-family: "Courier New", monospace; background: #f5f5f5; padding: 1pt 3pt; }
  pre  { font-family: "Courier New", monospace; background: #f5f5f5; padding: 8pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4pt 8pt; }
  th { background: #f0f0f0; font-weight: bold; }
</style>
</head>
<body>${body}</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Word HTML render error:", message);
    return NextResponse.json({ error: "Render failed", detail: message }, { status: 500 });
  }
}
