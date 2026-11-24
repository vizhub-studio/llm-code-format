import { matchStreamingFilename } from "./filenameFormats.js";

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
        // Reset content tracking for new file.
        this.currentFileName = fileName;
        this.currentFileHasContent = false;
        this.detectedFormat = format;
        await this.callbacks.onFileNameChange(fileName, format);
      } else if (this.callbacks.onNonCodeLine) {
        await this.callbacks.onNonCodeLine(line);
      }
    }
  }
}
