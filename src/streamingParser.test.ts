import { describe, it, expect, beforeEach } from "vitest";
import {
  StreamingMarkdownParser,
  StreamingParserCallbacks,
} from "./streamingParser";
import { sampleStreams } from "./sampleStreams";

describe("StreamingMarkdownParser", () => {
  let fileNameChanges: Array<{
    name: string;
    format: string;
  }>;
  let codeLines: string[];
  let nonCodeLines: string[];
  let parser: StreamingMarkdownParser;

  const callbacks: StreamingParserCallbacks = {
    onFileNameChange: async (fileName, format) => {
      fileNameChanges.push({ name: fileName, format });
    },
    onCodeLine: async (line) => {
      codeLines.push(line);
    },
    onNonCodeLine: async (line) => {
      nonCodeLines.push(line);
    },
  };

  beforeEach(() => {
    fileNameChanges = [];
    codeLines = [];
    nonCodeLines = [];
    parser = new StreamingMarkdownParser(callbacks);
  });

  it("should process a complete markdown block in one chunk", async () => {
    const input = "**index.html**\n```\n<html>\n</html>\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
  });

  it("should handle multiple chunks with split lines", async () => {
    // Simulate splitting a header and code block across chunks
    await parser.processChunk("**inde");
    await parser.processChunk("x.html**\n```\n<ht");
    await parser.processChunk("ml>\n</html>\n```");
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
  });

  it("should process multiple files and code blocks", async () => {
    const input =
      "**index.html**\n```\n<html>\n</html>\n```\n" +
      "**styles.css**\n```\nbody { color: blue; }\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
      { name: "styles.css", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>", "body { color: blue; }"]);
  });

  it("should handle code fence markers with language specifiers", async () => {
    const input = "**script.js**\n```js\nconsole.log('Hello');\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "script.js", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["console.log('Hello');"]);
  });

  it("should flush remaining partial lines on flushRemaining", async () => {
    // Provide a header line without a trailing newline
    await parser.processChunk("**partial.html**");
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "partial.html", format: "Bold Format" },
    ]);
  });

  it("should not trigger file name or code callbacks for irrelevant lines outside code fences", async () => {
    // Provide a line that doesn't match any header or code fence
    await parser.processChunk("This is an irrelevant line\n");
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([]);
    expect(codeLines).toEqual([]);
    expect(nonCodeLines).toEqual(["This is an irrelevant line"]);
  });

  it("should handle nested chunks with header and code block boundaries", async () => {
    // Simulate a stream with multiple boundaries and chunk splits
    const chunks = [
      "**index.html**\n", // Header detected
      "```\n<ht", // Start code fence and partial code
      "ml>\n</ht", // Continuation of code
      "ml>\n```\n", // End code fence
      "Some irrelevant line\n", // Irrelevant line outside code fence
      "**styles.css**\n", // New header
      "```\nbody { color:", // Start second code fence with split code line
      " blue; }\n```\n", // End code fence
    ];

    for (const chunk of chunks) {
      await parser.processChunk(chunk);
    }
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
      { name: "styles.css", format: "Bold Format" },
    ]);

    expect(codeLines).toEqual(["<html>", "</html>", "body { color: blue; }"]);
    expect(nonCodeLines).toEqual(["Some irrelevant line"]);
  });

  it("should handle bold format with extra text", async () => {
    const input =
      "**index.html** (some commentary)\n```\n<html>\n</html>\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
  });

  it("should handle bold format with parentheses and strip them", async () => {
    const input =
      "**renderArcs.js (New file)**\n```\n// JavaScript content\n```\n" +
      "**utils.js (Modified)**\n```\n// More content\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "renderArcs.js", format: "Bold Format" },
      { name: "utils.js", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["// JavaScript content", "// More content"]);
  });

  it("should handle bold format with inner backticks", async () => {
    const input = "**`index.html`**\n```\n<html>\n</html>\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
  });

  it("should detect a backtick-only header line", async () => {
    const input = "`index.html`\n```\n<html>\n</html>\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Backtick Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
  });

  it("should capture all non-code, non-header lines", async () => {
    const input =
      "This is a regular text line\n" +
      "**index.html**\n" +
      "This is a comment about the file\n" +
      "```\n<html>\n</html>\n```\n" +
      "Another comment line\n" +
      "And one more line\n";

    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "index.html", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["<html>", "</html>"]);
    expect(nonCodeLines).toEqual([
      "This is a regular text line",
      "This is a comment about the file",
      "Another comment line",
      "And one more line",
    ]);
  });

  it("should handle file deletion when empty code block is detected", async () => {
    const deletedFiles: string[] = [];

    const callbacksWithDelete: StreamingParserCallbacks = {
      onFileNameChange: async (fileName, format) => {
        fileNameChanges.push({ name: fileName, format });
      },
      onCodeLine: async (line) => {
        codeLines.push(line);
      },
      onNonCodeLine: async (line) => {
        nonCodeLines.push(line);
      },
      onFileDelete: async (fileName) => {
        deletedFiles.push(fileName);
      },
    };

    const deleteParser = new StreamingMarkdownParser(callbacksWithDelete);

    // Test case: File with completely empty code block
    const input = "**fileToDelete.js**\n\n```\n```\n";
    await deleteParser.processChunk(input);
    await deleteParser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "fileToDelete.js", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual([]);
    expect(deletedFiles).toEqual(["fileToDelete.js"]);
  });

  it("should handle file deletion with whitespace-only code block", async () => {
    const deletedFiles: string[] = [];

    const callbacksWithDelete: StreamingParserCallbacks = {
      onFileNameChange: async (fileName, format) => {
        fileNameChanges.push({ name: fileName, format });
      },
      onCodeLine: async (line) => {
        codeLines.push(line);
      },
      onNonCodeLine: async (line) => {
        nonCodeLines.push(line);
      },
      onFileDelete: async (fileName) => {
        deletedFiles.push(fileName);
      },
    };

    const deleteParser = new StreamingMarkdownParser(callbacksWithDelete);

    // Test case: File with whitespace-only code block
    const input = "**emptyFile.css**\n\n```\n   \n\t\n```\n";
    await deleteParser.processChunk(input);
    await deleteParser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "emptyFile.css", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["   ", "\t"]);
    expect(deletedFiles).toEqual(["emptyFile.css"]);
  });

  it("should not delete file with actual content", async () => {
    const deletedFiles: string[] = [];

    const callbacksWithDelete: StreamingParserCallbacks = {
      onFileNameChange: async (fileName, format) => {
        fileNameChanges.push({ name: fileName, format });
      },
      onCodeLine: async (line) => {
        codeLines.push(line);
      },
      onNonCodeLine: async (line) => {
        nonCodeLines.push(line);
      },
      onFileDelete: async (fileName) => {
        deletedFiles.push(fileName);
      },
    };

    const deleteParser = new StreamingMarkdownParser(callbacksWithDelete);

    // Test case: File with actual content
    const input = "**normalFile.js**\n\n```\nconsole.log('hello');\n```\n";
    await deleteParser.processChunk(input);
    await deleteParser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "normalFile.js", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["console.log('hello');"]);
    expect(deletedFiles).toEqual([]); // No files should be deleted
  });

  it("should handle mixed scenario with deletion and normal files", async () => {
    const deletedFiles: string[] = [];

    const callbacksWithDelete: StreamingParserCallbacks = {
      onFileNameChange: async (fileName, format) => {
        fileNameChanges.push({ name: fileName, format });
      },
      onCodeLine: async (line) => {
        codeLines.push(line);
      },
      onNonCodeLine: async (line) => {
        nonCodeLines.push(line);
      },
      onFileDelete: async (fileName) => {
        deletedFiles.push(fileName);
      },
    };

    const deleteParser = new StreamingMarkdownParser(callbacksWithDelete);

    // Mixed scenario: normal file, deleted file, another normal file
    const input =
      "**keepThis.js**\n```\nconsole.log('keep');\n```\n" +
      "**deleteThis.js**\n```\n```\n" +
      "**alsoKeep.css**\n```\nbody { color: red; }\n```\n";

    await deleteParser.processChunk(input);
    await deleteParser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "keepThis.js", format: "Bold Format" },
      { name: "deleteThis.js", format: "Bold Format" },
      { name: "alsoKeep.css", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual(["console.log('keep');", "body { color: red; }"]);
    expect(deletedFiles).toEqual(["deleteThis.js"]);
  });

  it("should work when onFileDelete callback is not provided", async () => {
    // Test that parser still works when onFileDelete is not provided
    const input = "**fileToDelete.js**\n```\n```\n";
    await parser.processChunk(input);
    await parser.flushRemaining();

    expect(fileNameChanges).toEqual([
      { name: "fileToDelete.js", format: "Bold Format" },
    ]);
    expect(codeLines).toEqual([]);
    // Should not throw error even though onFileDelete is not defined
  });

  it("should process sample streams and match expected files", async () => {
    for (const [index, sampleStream] of sampleStreams.entries()) {
      // Reset state for each sample stream
      const fileContents: Record<string, string[]> = {};
      let currentFileName: string | null = null;

      const streamCallbacks: StreamingParserCallbacks = {
        onFileNameChange: async (fileName, format) => {
          currentFileName = fileName;
          if (!fileContents[fileName]) {
            fileContents[fileName] = [];
          }
        },
        onCodeLine: async (line) => {
          if (currentFileName) {
            fileContents[currentFileName].push(line);
          }
        },
        onNonCodeLine: async () => {
          // Non-code lines are not part of file contents
        },
      };

      const streamParser = new StreamingMarkdownParser(streamCallbacks);

      // Process all chunks in the sample stream
      for (const chunk of sampleStream.chunks) {
        await streamParser.processChunk(chunk);
      }
      await streamParser.flushRemaining();

      // Convert arrays to strings and compare with expected files
      const builtFiles: Record<string, string> = {};
      Object.keys(fileContents).forEach((fileName) => {
        builtFiles[fileName] = fileContents[fileName].join("\n");
      });

      // console.log(JSON.stringify(builtFiles, null, 2));

      // Check each expected file
      Object.keys(sampleStream.expectedFiles).forEach((expectedFileName) => {
        // console.log(builtFiles[expectedFileName]);
        expect(builtFiles[expectedFileName]).toBeDefined();
        expect(builtFiles[expectedFileName]).toBe(
          sampleStream.expectedFiles[expectedFileName],
        );
      });

      // Check that no unexpected files are present
      Object.keys(builtFiles).forEach((builtFileName) => {
        expect(sampleStream.expectedFiles[builtFileName]).toBeDefined();
      });
    }
  });
});
