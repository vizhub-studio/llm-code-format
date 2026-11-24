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

// Batch matching also requires a code fence; streaming matches header lines.
const boldHeaderSource = /\*\*([^\n*]+?)\*\*(?:[^\n]*)\s*/.source;
const backtickHeaderSource = /`([^`]+)`\s*:?\s*/.source;
const codeBlockSource = /\n```(?:\w+)?\n([\s\S]*?)```/.source;

/** Fresh global regexes preserve batch format priority and matching state. */
export function getBatchFilenamePatterns() {
  const backtickHeadingRegex =
    /^\s*###\s*`([^`]+)`\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const bareBacktickFormatRegex = new RegExp(
    /^\s*/.source + backtickHeaderSource + codeBlockSource,
    "gm",
  );
  const fileBoldFormatRegex =
    /^\s*###\s*File:\s*\*\*(.+?)\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const numberedBacktickFormatRegex =
    /^\s*###\s*\d+\.\s*`([^`]+)`(?:[^\n]*\n)*?\s*```(?:\w+)?\n([\s\S]*?)```/gm;
  const standardHeadingRegex =
    /^\s*###\s*(?!`|File:|\d+\.)\s*([^\n`]+?)\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const colonFormatRegex =
    /^\s*(?!###|\*\*|`)([^\n#*`]+?):\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const hashFormatRegex = /^\s*# ([^\n`]+?)\s*\n```(?:\w+)?\n([\s\S]*?)```/gm;
  const boldFormatRegex = new RegExp(
    /^\s*(?!###)/.source + boldHeaderSource + codeBlockSource,
    "gm",
  );
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
  return regexes;
}

// Streaming recognizes the original two formats plus the prefixed bold variant.
const streamingPatterns = [
  {
    regex: new RegExp(/^\s*/.source + boldHeaderSource + "$"),
    format: "Bold Format",
  },
  {
    regex: new RegExp(/^\s*/.source + backtickHeaderSource + "$"),
    format: "Backtick Format",
  },
];

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
      return { fileName: normalizeFileName(match[1], format), format };
    }
  }
  return null;
}
