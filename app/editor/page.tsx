"use client";

import { useState, useEffect } from "react";
import { Toolbar } from "@/components/editor/Toolbar";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { Preview } from "@/components/editor/Preview";
import { parseMarkdownToHtml } from "@/lib/markdown/parse";

const INITIAL_MARKDOWN = `# Q.9) Derive an expression for barrier potential in a p-n junction diode.`; // Replaced by fetch anyway

export default function EditorPage() {
  const [markdown, setMarkdown] = useState("# Loading...");
  const [html, setHtml] = useState("");
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  useEffect(() => {
    fetch('/torture.md')
      .then(res => res.text())
      .then(text => setMarkdown(text))
      .catch(err => console.error(err));
  }, []);

  // Debounced parsing
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await parseMarkdownToHtml(markdown);
        setHtml(result);
      } catch (error) {
        console.error("Failed to parse markdown:", error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [markdown]);

  const handleExportDocx = async () => {
    try {
      setIsExportingDocx(true);
      const response = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || "Failed to generate DOCX");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CopyCit-Document.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Failed to export DOCX:", msg);
      alert(`Export failed: ${msg}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-muted/30">
      <Toolbar
        onExportDocx={handleExportDocx}
        isExportingDocx={isExportingDocx}
      />
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden gap-px bg-border/60">
        {/* Editor panel */}
        <div className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full bg-background overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/40 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Markdown</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor value={markdown} onChange={setMarkdown} />
          </div>
        </div>
        {/* Preview panel */}
        <div className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full bg-background overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/40 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Preview</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Preview html={html} />
          </div>
        </div>
      </div>
    </div>
  );
}
