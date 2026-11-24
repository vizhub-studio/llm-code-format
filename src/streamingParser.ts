import {
  isAmbiguousFilenameFormat,
  matchStreamingFilename,
} from "./filenameFormats.js";

export type StreamingParserCallbacks = {
  /**
   * Called when a file header is detected outside a code fence.
   * @param fileName - The detected file name.
   * @param format - The header format that was matched.
   */
  onFileNameChange: (fileName: string, format: string) => Promise<void>;

  /**
   * Called for each line emitted from inside a code fence.
   * @param line - A line of code from the code block.
   */
  onCodeLine: (line: string) => Promise<void>;

  /**
   * Called for each line outside code fences that is not a file header.
   * @param line - A line of text that is not code or a file header.
   */
  onNonCodeLine?: (line: string) => Promise<void>;

  /**
   * Called when a file should be deleted (empty code block detected).
   * @param fileName - The name of the file to be deleted.
   */
  onFileDelete?: (fileName: string) => Promise<void>;
};

export class StreamingMarkdownParser {
  private buffer: string = "";
  private insideCodeFence: boolean = false;
  private currentFileName: string | null = null;
  private detectedFormat: string = "Unknown Format";
  private callbacks: StreamingParserCallbacks;
  private currentFileHasContent: boolean = false;
  private pendingHeader: {
    fileName: string;
    format: string;
    lines: string[];
  } | null = null;

  constructor(callbacks: StreamingParserCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Processes an incoming chunk from the stream.
   * Chunks are buffered until full lines (ending with '\n') are available.
   * @param chunk - A string chunk from the stream.
   */
  async processChunk(chunk: string) {
    this.buffer += chunk;
    let newlineIndex: number;

    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      await this.processLine(line);
    }
  }

  /**
   * Flushes any remaining content in the buffer.
   * Should be called once after the stream has ended.
   */
  async flushRemaining() {
    if (this.buffer.length > 0) {
      await this.processLine(this.buffer);
      this.buffer = "";
    }
    // An ambiguous header at EOF without a fence is ordinary prose.
    await this.resolvePendingHeader(false);
  }

  private async emitHeader(fileName: string, format: string) {
    this.currentFileName = fileName;
    this.currentFileHasContent = false;
    this.detectedFormat = format;
    await this.callbacks.onFileNameChange(fileName, format);
  }

  /**
   * Confirm a plain filename header only when the next nonblank line is
   * a fence. Otherwise replay the buffered lines as prose in their original order.
   */
  private async resolvePendingHeader(confirmed: boolean) {
    const pending = this.pendingHeader;
    if (!pending) return;
    this.pendingHeader = null;
    if (confirmed) {
      await this.emitHeader(pending.fileName, pending.format);
    }
    if (this.callbacks.onNonCodeLine) {
      for (const line of pending.lines.slice(confirmed ? 1 : 0)) {
        await this.callbacks.onNonCodeLine(line);
      }
    }
  }

  /**
   * Processes a single line.
   * If the line is a code fence marker (starting with "```"), it toggles the code block state.
   * When inside a code block, every line is emitted via onCodeLine.
   * Outside of a code block, the line is checked against header patterns,
   * and if a match is found, onFileNameChange is invoked.
   * @param line - A single line of text.
   */
  private async processLine(line: string) {
    if (this.pendingHeader) {
      if (line.trim() === "") {
        this.pendingHeader.lines.push(line);
        return;
      }
      await this.resolvePendingHeader(line.trim().startsWith("```"));
    }

    // Check if the line is a code fence marker (could be "```" or "```lang")
    if (line.trim().startsWith("```")) {
      const wasInsideCodeFence = this.insideCodeFence;
      this.insideCodeFence = !this.insideCodeFence;

      // If we're ending a code fence and the current file had no content, trigger deletion
      if (wasInsideCodeFence && !this.insideCodeFence) {
        if (
          this.currentFileName &&
          !this.currentFileHasContent &&
          this.callbacks.onFileDelete
        ) {
          await this.callbacks.onFileDelete(this.currentFileName);
        }
      }

      return; // The fence marker itself is not emitted as code content.
    }

    if (this.insideCodeFence) {
      // Emit every line inside the code fence as a code line.
      await this.callbacks.onCodeLine(line);

      // Track if this file has any non-whitespace content
      if (line.trim().length > 0) {
        this.currentFileHasContent = true;
      }
    } else {
      const header = matchStreamingFilename(line);
      if (header) {
        const { fileName, format } = header;
        if (isAmbiguousFilenameFormat(format)) {
          this.pendingHeader = { fileName, format, lines: [line] };
        } else {
          await this.emitHeader(fileName, format);
        }
      } else if (this.callbacks.onNonCodeLine) {
        await this.callbacks.onNonCodeLine(line);
      }
    }
  }
}
