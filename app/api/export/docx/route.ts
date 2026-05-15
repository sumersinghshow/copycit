import { NextRequest, NextResponse } from "next/server";
import { generateDocxBuffer } from "@/lib/markdown/docx";

export const maxDuration = 30; // 30 second timeout for heavy DOCX generation

export async function POST(req: NextRequest) {
  try {
    const { markdown } = await req.json();

    if (!markdown) {
      return NextResponse.json({ error: "Markdown content is required" }, { status: 400 });
    }

    const buffer = await generateDocxBuffer(markdown);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="CopyCit-Document.docx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DOCX export error:", message);
    return NextResponse.json({ error: "Failed to generate DOCX", detail: message }, { status: 500 });
  }
}
