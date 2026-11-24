// parseMarkdownFiles.ts
import { FileCollection } from "@vizhub/viz-types";

import {
  getBatchFilenamePatterns,
  isAcceptedBatchFileName,
  normalizeFileName,
  normalizePrefixedBoldHeaders,
} from "./filenameFormats.js";

export type DuplicateFilenameResolution = "last" | "first" | "longest";

export interface ParseMarkdownFilesOptions {
  /** Resolve repeated normalized filenames in the selected batch format. */
  duplicateResolution?: DuplicateFilenameResolution;
}

export function parseMarkdownFiles(
  markdownString: string,
  format?: string,
  options: ParseMarkdownFilesOptions = {},
): { files: FileCollection; format: string } {
  const duplicateResolution = options.duplicateResolution ?? "last";
  if (
    duplicateResolution !== "last" &&
    duplicateResolution !== "first" &&
    duplicateResolution !== "longest"
  ) {
    throw new Error(`Unsupported duplicate resolution: ${duplicateResolution}`);
  }
  const regexes = getBatchFilenamePatterns();
  const normalizedMarkdown = normalizePrefixedBoldHeaders(markdownString);

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

      while ((match = regex.exec(normalizedMarkdown)) !== null) {
        const name = normalizeFileName(match[1], fmt);
        if (!isAcceptedBatchFileName(name, fmt)) continue;
        const code = match[2].trim();
        const hasPrevious = Object.prototype.hasOwnProperty.call(matches, name);
        if (
          !hasPrevious ||
          duplicateResolution === "last" ||
          (duplicateResolution === "longest" &&
            code.length > matches[name].length)
        ) {
          matches[name] = code;
        }
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
