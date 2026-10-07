// parseMarkdownFiles.ts
import { FileCollection } from "@vizhub/viz-types";

/**
 * Formats whose header regexes capture arbitrary text before a fence, so they
 * can match prose (`### Notes.`, `Results:`, `# Results`) as if it were a
 * filename. Names from these formats must pass {@link looksLikeFileName}.
 */
const AMBIGUOUS_FORMATS = new Set([
  "Standard Heading Format",
  "Colon Format",
  "Hash Format",
]);

/**
 * True when a captured name looks like a file rather than prose.
 *
 * Accepts a name with a file-extension suffix (`index.js`, `data.csv`) or a
 * path separator (`path/to/file`); rejects anything containing whitespace.
 * A trailing colon is ignored so a `### index.js:` heading is still accepted.
 */
function looksLikeFileName(raw: string): boolean {
  const name = raw.trim().replace(/:+$/, "").trim();
  if (name.length === 0 || /\s/.test(name)) return false;
  return /\.[A-Za-z0-9]{1,10}$/.test(name) || name.includes("/");
}

export function parseMarkdownFiles(
  markdownString: string,
  format?: string,
): { files: FileCollection; format: string } {
  const backtickHeadingRegex =
    /^\s*###\s*`([^`]+)`\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const bareBacktickFormatRegex =
    /^\s*`([^`]+)`\s*:?\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const fileBoldFormatRegex =
    /^\s*###\s*File:\s*\*\*(.+?)\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const numberedBacktickFormatRegex =
    /^\s*###\s*\d+\.\s*`([^`]+)`(?:[^\n]*\n)*?\s*```(?:\w+)?\n([\s\S]*?)```/gm;
  const standardHeadingRegex =
    /^\s*###\s*(?!`|File:|\d+\.)\s*([^\n`]+?)\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const colonFormatRegex =
    /^\s*(?!###|\*\*|`)([^\n#*`]+?):\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const hashFormatRegex = /^\s*# ([^\n`]+?)\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const boldFormatRegex =
    /^\s*(?!###)\*\*([^\n*]+?)\*\*(?:[^\n]*)\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const headingBoldFormatRegex =
    /^### \*\*([^\n`]+?)\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const numberedBoldFormatRegex =
    /^\s*\d+\.\s*\*\*([^\n`]+?)\*\*[\s\S]*?\n```(?:\w+)?\n([\s\S]*?)```/gm;

  // Associate each regex with a unique, lowercase key
  const regexes = [
    {
      regex: backtickHeadingRegex,
      format: "Backtick-Heading Format",
      key: "backtick-heading",
    },
    {
      regex: bareBacktickFormatRegex,
      format: "Backtick Format",
      key: "backtick",
    },
    {
      regex: fileBoldFormatRegex,
      format: "File Bold Format",
      key: "file-bold",
    },
    {
      regex: numberedBacktickFormatRegex,
      format: "Numbered Backtick Format",
      key: "numbered-backtick",
    },
    {
      regex: headingBoldFormatRegex,
      format: "Heading Bold Format",
      key: "heading-bold",
    },
    {
      regex: standardHeadingRegex,
      format: "Standard Heading Format",
      key: "standard-heading",
    },
    {
      regex: colonFormatRegex,
      format: "Colon Format",
      key: "colon",
    },
    {
      regex: boldFormatRegex,
      format: "Bold Format",
      key: "bold",
    },
    {
      regex: hashFormatRegex,
      format: "Hash Format",
      key: "hash",
    },
    {
      regex: numberedBoldFormatRegex,
      format: "Numbered Bold Format",
      key: "numbered-bold",
    },
  ];

  // Process a list of regexes and stop after the first matching format
  const parseWith = (
    regexList: typeof regexes,
  ): { files: FileCollection; format: string } => {
    const parsedFiles: FileCollection = {};
    let detectedFormat = "Unknown Format";

    for (const { regex, format: fmt } of regexList) {
      regex.lastIndex = 0; // Reset regex index
      const matches: Record<string, string> = {};
      let match;

      while ((match = regex.exec(markdownString)) !== null) {
        let name = match[1].trim();
        // For Bold Format, strip out parentheses and any content after them
        if (fmt === "Bold Format") {
          // Remove anything in parentheses and trim
          name = name.replace(/\s*\([^)]*\).*$/, "").trim();
          // Strip surrounding backticks from the name
          name = name.replace(/^`+|`+$/g, "");
        }
        // Prose-prone formats must look like a filename; skip prose matches so
        // a heading like `### Notes.` is not turned into a spurious file.
        if (AMBIGUOUS_FORMATS.has(fmt) && !looksLikeFileName(name)) continue;
        const code = match[2].trim();
        matches[name] = code;
      }

      if (Object.keys(matches).length > 0) {
        Object.assign(parsedFiles, matches);
        detectedFormat = fmt;
        break; // Stop after the first matching format
      }
    }

    return { files: parsedFiles, format: detectedFormat };
  };

  if (format) {
    // Find the regex that matches the specified format
    const formatRegexEntry = regexes.find((r) => r.key === format);
    if (!formatRegexEntry) {
      throw new Error(`Unsupported format: ${format}`);
    }

    // Try the explicitly requested format first.
    const explicitResult = parseWith([formatRegexEntry]);
    if (Object.keys(explicitResult.files).length > 0) {
      return explicitResult;
    }

    // Fall back to auto-detect when the requested format matched nothing.
    return parseWith(regexes);
  }

  return parseWith(regexes);
}
