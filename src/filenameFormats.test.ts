import { expect, test } from "vitest";
import { parseMarkdownFiles } from "./parseMarkdownFiles";
import { StreamingMarkdownParser } from "./streamingParser";

// Shared characterization fixtures for the formats both parsers support.
const sharedFixtures = [
  ["**index.js**", "index.js", "Bold Format"],
  ["  **src/app.ts** (updated)", "src/app.ts", "Bold Format"],
  ["**config.json (new file)**", "config.json", "Bold Format"],
  ["**`styles.css`**", "styles.css", "Bold Format"],
  ["`index.js`", "index.js", "Backtick Format"],
  ["  `src/app.ts`:", "src/app.ts", "Backtick Format"],
  ["**README**", "README", "Bold Format"],
  ["`path/to/Makefile`", "path/to/Makefile", "Backtick Format"],
];

const batchFixtures = [
  ...sharedFixtures,
  ["### `index.js`", "index.js", "Backtick-Heading Format"],
  ["### File: **index.js**", "index.js", "File Bold Format"],
  ["### 1. `index.js`", "index.js", "Numbered Backtick Format"],
  ["### **index.js**", "index.js", "Heading Bold Format"],
  ["### index.js", "index.js", "Standard Heading Format"],
  ["index.js:", "index.js", "Colon Format"],
  ["# index.js", "index.js", "Hash Format"],
  ["1. **index.js**", "index.js", "Numbered Bold Format"],
];

const markdown = (header: string) =>
  [header, "", "```js", "const x = 1;", "```"].join("\n");

test.each(batchFixtures)(
  "batch recognizes %s as %s (%s)",
  (header, name, format) => {
    expect(parseMarkdownFiles(markdown(header))).toEqual({
      files: { [name]: "const x = 1;" },
      format,
    });
  },
);

test.each(sharedFixtures)(
  "streaming recognizes %s as %s (%s)",
  async (header, name, format) => {
    const names: Array<{ name: string; format: string }> = [];
    const code: string[] = [];
    const parser = new StreamingMarkdownParser({
      onFileNameChange: async (name, format) => {
        names.push({ name, format });
      },
      onCodeLine: async (line) => {
        code.push(line);
      },
    });
    // Character-sized chunks exercise buffering and the final fence flush.
    for (const character of markdown(header)) {
      await parser.processChunk(character);
    }
    await parser.flushRemaining();
    expect(names).toEqual([{ name, format }]);
    expect(code).toEqual(["const x = 1;"]);
  },
);

test.each(["### Notes.", "Results:", "# Results"])(
  "batch continues rejecting prose header %s",
  (header) => {
    expect(parseMarkdownFiles(markdown(header))).toEqual({
      files: {},
      format: "Unknown Format",
    });
  },
);

test("streaming preserves prose and does not interpret headers inside fences", async () => {
  const names: string[] = [];
  const prose: string[] = [];
  const code: string[] = [];
  const parser = new StreamingMarkdownParser({
    onFileNameChange: async (name) => {
      names.push(name);
    },
    onNonCodeLine: async (line) => {
      prose.push(line);
    },
    onCodeLine: async (line) => {
      code.push(line);
    },
  });
  await parser.processChunk(
    "### Notes.\n**index.js**\n```js\n**not-a-header.js**\n```",
  );
  await parser.flushRemaining();
  expect(names).toEqual(["index.js"]);
  expect(prose).toEqual(["### Notes."]);
  expect(code).toEqual(["**not-a-header.js**"]);
});
