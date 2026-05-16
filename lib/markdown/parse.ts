import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

export function preprocessAIOutput(md: string): string {
  // 1. Unicode & Invisible Character Cleanup
  // Remove zero-width spaces and other invisible characters
  let processed = md.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  // Normalize smart quotes
  processed = processed.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 2. Code Fence Repair
  // Replace 4 or 5 backticks with 3 backticks
  processed = processed.replace(/^`{4,5}/gm, '```');

  // 3. Advanced Math Normalization
  // Convert \[ ... \] display math on a single line: \[ expr \] → $$ expr $$
  processed = processed.replace(/\\{1,2}\[([^\]]*?)\\{1,2}\]/g, '\n$$$$\n$1\n$$$$\n');

  // Convert \[ \] and \\[ \\] that are alone on their own lines (multi-line block math)
  // In JS replace(), '$$' means a single '$'. To insert '$$', we must use '$$$$'.
  processed = processed.replace(/^\\{0,2}\[$/gm, '$$$$').replace(/^\\{0,2}\]$/gm, '$$$$');

  // Replace inline \( \) and \\( \\) with $ — but NOT \left( or \right( (negative lookbehind for letters)
  processed = processed.replace(/(?<![a-zA-Z])\\{1,2}\(/g, '$').replace(/(?<![a-zA-Z])\\{1,2}\)/g, '$');

  // Convert parenthesised math that contains LaTeX commands or subscripts/superscripts:
  // (E_{Fn}), (V_T = \dfrac{kT}{e}), (n_i^2), etc. → $E_{Fn}$
  // Lookbehind: NOT preceded by a letter (blocks \left, \sin, etc.) OR } (blocks 10^{n}(...))
  processed = processed.replace(
    /(?<![a-zA-Z}])\(([^()]*(?:\\[a-zA-Z]+|_|\^|\{|\})[^()]*)\)/g,
    '$$$1$$'
  );

  // Replace plain parentheses around simple single math variables like (V_0) or (N_A)
  const mathParensRegex = /(?<![a-zA-Z}])\(([A-Za-z](?:_[A-Za-z0-9{}]+)?(?:\s*=\s*[A-Za-z0-9_{}]+)?)\)/g;
  processed = processed.replace(mathParensRegex, '$$$1$$');

  // 4. Bare-line LaTeX → display math block
  // ChatGPT outputs equations with NO delimiters — raw LaTeX on its own line.
  // Match lines that contain: a backslash command (\frac, \exp, etc.)
  //   OR subscript/superscript notation (_{x}, ^{x}, _x, ^x)
  //   but are NOT already math-delimited, not headings/list items, not prose.
  processed = processed.replace(
    /^(?!\s*\$)(.*)$/gm,
    (match) => {
      const t = match.trim();
      if (!t) return match;
      // Skip headings, list items, code fences, blockquotes
      if (/^(#|\*|-|\d+\.|>|```)/.test(t)) return match;
      // Skip normal prose sentences (contain common English words)
      if (/\b(the|and|or|is|are|of|in|on|at|to|for|with|where|since|using|therefore|similarly|substituting)\b/i.test(t)) return match;
      // Must look like LaTeX: has \cmd OR has _{} / ^{} / _x patterns
      const hasBackslashCmd = /\\[a-zA-Z]/.test(t);
      const hasSubscriptOrSuper = /[_^]\{|[_^][a-zA-Z0-9]/.test(t);
      if (hasBackslashCmd || hasSubscriptOrSuper) {
        return `\n$$\n${t}\n$$\n`;
      }
      return match;
    }
  );

  // 6. Broken Layout Recovery
  // Replace lines that contain only '=' characters with a single '='
  // (AI often uses '===' as an ASCII-art equals sign to match the height of fractions)
  processed = processed.replace(/^=+$/gm, '=');

  // Fix double-spaced tables (rows separated by empty lines)
  processed = processed.replace(/^(\|.*)$(\r?\n)^\s*$(\r?\n)(?=\|)/gm, '$1$2');

  return processed;
}

export async function parseMarkdownToHtml(markdown: string): Promise<string> {
  const preprocessed = preprocessAIOutput(markdown);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { strict: false }) // Disable strict mode so weird AI KaTeX doesn't crash
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(preprocessed);

  return String(file);
}

/**
 * Generates HTML with MathML equations (not CSS-based KaTeX HTML).
 * When pasted into Word, MathML is automatically converted to native
 * Word equations (OMML) — giving proper rendered math in the document.
 */
export async function parseMarkdownToWordHtml(markdown: string): Promise<string> {
  const preprocessed = preprocessAIOutput(markdown);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { output: 'mathml', strict: false })
    .use(rehypeStringify)
    .process(preprocessed);

  // Wrap in a minimal HTML document so Word picks up the structure correctly
  const body = String(file);
  return `<!DOCTYPE html><html><body>${body}</body></html>`;
}
