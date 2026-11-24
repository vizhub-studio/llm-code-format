// Shared filename formats and normalization for the batch and streaming parsers.

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

/** Normalize a captured filename without changing format-specific behavior. */
export function normalizeFileName(raw: string, format: string): string {
  let name = raw.trim();
  if (format === "Bold Format") {
    name = name.replace(/\s*\([^)]*\).*$/, "").trim();
    name = name.replace(/^`+|`+$/g, "");
  }
  return name;
}

/** Preserve the batch parser's validation of prose-prone formats. */
export function isAcceptedBatchFileName(name: string, format: string): boolean {
  return !AMBIGUOUS_FORMATS.has(format) || looksLikeFileName(name);
}

// Only explicit file-action labels are accepted, not arbitrary prose.
// The optional Markdown heading marker and descriptive prefix are not part
// of the filename. Keep existing unprefixed formats unchanged.
const prefixedBoldHeader =
  /^[ \t]*(?:#{1,6}[ \t]+)?(?:updated|modified|new|added|changed|revised|edited|created|update|modify|add|create|edit|replace|replacement)(?:[ \t]+file)?(?:[ \t]*:[ \t]*|[ \t]+)\*\*([^\r\n*]+?)\*\*(?:[ \t]*\([^*\r\n]*\)|[ \t]*:[^*\r\n]*)?[ \t]*$/i;

/** Recognize a prefixed bold filename, with stricter checks for this new syntax. */
function matchPrefixedBoldFilename(line: string): string | null {
  const match = prefixedBoldHeader.exec(line);
  if (!match) return null;
  const name = normalizeFileName(match[1], "Bold Format");
  // Require filename-like syntax and reject prose, URLs, and traversal.
  if (!looksLikeFileName(name) || !/^[\w.@+-]+(?:\/[\w.@+-]+)*$/.test(name)) {
    return null;
  }
  if (name.split("/").some((part) => part === "." || part === "..")) {
    return null;
  }
  return name;
}

/**
 * Canonicalize the new header variant before batch format detection.
 * Only rewrite headers outside fenced blocks and followed by a supported
 * opening fence. This preserves the legacy format priority and lets plain
 * and prefixed bold filenames coexist without rewriting file contents.
 */
export function normalizePrefixedBoldHeaders(markdown: string): string {
  const lines = markdown.split("\n");
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        marker[2].trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    const name = matchPrefixedBoldFilename(line);
    if (name === null) continue;
    let next = i + 1;
    while (next < lines.length && lines[next].trim() === "") next++;
    if (next < lines.length && /^```(?:\w+)?$/.test(lines[next])) {
      lines[i] = `**${name}**`;
    }
  }
  return lines.join("\n");
}

// Both parsers use the same ordered header definitions. Only the suffix
// differs: batch parsing requires a full code block, while streaming
// recognizes the header line. Numbered formats allow intervening commentary.
const codeBlockSource = /\n```(?:\w+)?\n([\s\S]*?)```/.source;

type FilenamePattern = {
  key: string;
  format: string;
  headerSource: string;
  batchSuffix?: string;
  lineSuffix?: string;
};

const filenamePatterns: FilenamePattern[] = [
  {
    key: "backtick-heading",
    format: "Backtick-Heading Format",
    headerSource: /^\s*###\s*`([^`]+)`\s*/.source,
  },
  {
    key: "backtick",
    format: "Backtick Format",
    headerSource: /^\s*`([^`]+)`\s*:?\s*/.source,
  },
  {
    key: "file-bold",
    format: "File Bold Format",
    headerSource: /^\s*###\s*File:\s*\*\*(.+?)\*\*\s*/.source,
  },
  {
    key: "numbered-backtick",
    format: "Numbered Backtick Format",
    headerSource: /^\s*###\s*\d+\.\s*`([^`]+)`/.source,
    batchSuffix: /(?:[^\n]*\n)*?\s*```(?:\w+)?\n([\s\S]*?)```/.source,
    lineSuffix: /[^\n]*/.source,
  },
  {
    key: "heading-bold",
    format: "Heading Bold Format",
    headerSource: /^### \*\*([^\n`]+?)\*\*\s*/.source,
  },
  {
    key: "standard-heading",
    format: "Standard Heading Format",
    headerSource: /^\s*###\s*(?!`|File:|\d+\.)\s*([^\n`]+?)\s*/.source,
  },
  {
    key: "colon",
    format: "Colon Format",
    headerSource: /^\s*(?!###|\*\*|`)([^\n#*`]+?):\s*/.source,
  },
  {
    key: "bold",
    format: "Bold Format",
    headerSource: /^\s*(?!###)\*\*([^\n*]+?)\*\*(?:[^\n]*)\s*/.source,
  },
  {
    key: "hash",
    format: "Hash Format",
    headerSource: /^\s*# ([^\n`]+?)\s*/.source,
  },
  {
    key: "numbered-bold",
    format: "Numbered Bold Format",
    headerSource: /^\s*\d+\.\s*\*\*([^\n`]+?)\*\*/.source,
    batchSuffix: /[\s\S]*?\n```(?:\w+)?\n([\s\S]*?)```/.source,
    lineSuffix: /[^\n]*/.source,
  },
];

/** Fresh global regexes preserve batch format priority and matching state. */
export function getBatchFilenamePatterns() {
  return filenamePatterns.map(({ key, format, headerSource, batchSuffix }) => ({
    key,
    format,
    regex: new RegExp(headerSource + (batchSuffix ?? codeBlockSource), "gm"),
  }));
}

/** Plain headers require code-fence context to distinguish them from prose. */
export function isAmbiguousFilenameFormat(format: string): boolean {
  return AMBIGUOUS_FORMATS.has(format);
}

const streamingPatterns = filenamePatterns.map(
  ({ format, headerSource, lineSuffix }) => ({
    format,
    regex: new RegExp(headerSource + (lineSuffix ?? "") + "$"),
  }),
);

export function matchStreamingFilename(line: string): {
  fileName: string;
  format: string;
} | null {
  const prefixed = matchPrefixedBoldFilename(line);
  if (prefixed !== null) {
    return { fileName: prefixed, format: "Bold Format" };
  }
  for (const { regex, format } of streamingPatterns) {
    const match = regex.exec(line);
    if (match) {
      const fileName = normalizeFileName(match[1], format);
      if (!isAcceptedBatchFileName(fileName, format)) continue;
      return { fileName, format };
    }
  }
  return null;
}
