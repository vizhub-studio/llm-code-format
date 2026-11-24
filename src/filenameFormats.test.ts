import { expect, test } from "vitest";
import { parseMarkdownFiles } from "./parseMarkdownFiles";
import { StreamingMarkdownParser } from "./streamingParser";

// Shared characterization fixtures for the original two streaming formats.
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

const allFormatFixtures = [
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

test.each(allFormatFixtures)(
  "batch recognizes %s as %s (%s)",
  (header, name, format) => {
    expect(parseMarkdownFiles(markdown(header))).toEqual({
      files: { [name]: "const x = 1;" },
      format,
    });
  },
);

test.each(allFormatFixtures)(
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

test.each(allFormatFixtures)(
  "streaming deletion uses the correct filename for %s",
  async (header, name, format) => {
    const events: string[] = [];
    const parser = new StreamingMarkdownParser({
      onFileNameChange: async (name, format) => {
        await Promise.resolve();
        events.push(`header:${name}:${format}`);
      },
      onCodeLine: async (line) => {
        await Promise.resolve();
        events.push(`code:${line}`);
      },
      onFileDelete: async (name) => {
        await Promise.resolve();
        events.push(`delete:${name}`);
      },
    });
    const input = [header, "", "```", "   ", "```"].join("\n");
    for (const character of input) await parser.processChunk(character);
    await parser.flushRemaining();
    expect(events).toEqual([
      `header:${name}:${format}`,
      "code:   ",
      `delete:${name}`,
    ]);
  },
);

test.each(["### Notes.", "Results:", "# Results"])(
  "streaming rejects ordinary prose header %s even before a fence",
  async (header) => {
    const names: string[] = [];
    const prose: string[] = [];
    const deleted: string[] = [];
    const parser = new StreamingMarkdownParser({
      onFileNameChange: async (name) => { names.push(name); },
      onCodeLine: async () => {},
      onNonCodeLine: async (line) => { prose.push(line); },
      onFileDelete: async (name) => { deleted.push(name); },
    });
    await parser.processChunk([header, "```", "```", ""].join("\n"));
    await parser.flushRemaining();
    expect(names).toEqual([]);
    expect(deleted).toEqual([]);
    expect(prose).toEqual([header]);
  },
);

test.each(["### notes.md", "notes.md:", "# notes.md"])(
  "ambiguous header %s is confirmed only by a following fence",
  async (header) => {
    const events: string[] = [];
    const parser = new StreamingMarkdownParser({
      onFileNameChange: async (name) => { events.push(`header:${name}`); },
      onCodeLine: async (line) => { events.push(`code:${line}`); },
      onNonCodeLine: async (line) => { events.push(`prose:${line}`); },
    });
    await parser.processChunk(header + "\n\n");
    expect(events).toEqual([]);
    await parser.processChunk("An explanation.\n");
    expect(events).toEqual([`prose:${header}`, "prose:", "prose:An explanation."]);
    events.length = 0;
    await parser.processChunk(header + "\n\n");
    await parser.processChunk("```js\n");
    expect(events).toEqual(["header:notes.md", "prose:"]);
    await parser.processChunk("content\n```\n");
    await parser.flushRemaining();
    expect(events).toEqual(["header:notes.md", "prose:", "code:content"]);
  },
);

test.each(["### notes.md", "notes.md:", "# notes.md"])(
  "unconfirmed header %s is replayed at EOF",
  async (header) => {
    const names: string[] = [];
    const prose: string[] = [];
    const parser = new StreamingMarkdownParser({
      onFileNameChange: async (name) => { names.push(name); },
      onCodeLine: async () => {},
      onNonCodeLine: async (line) => { prose.push(line); },
    });
    await parser.processChunk(header + "\n\n");
    await parser.flushRemaining();
    await parser.flushRemaining();
    expect(names).toEqual([]);
    expect(prose).toEqual([header, ""]);
  },
);

test.each([
  ["### 1. `src/app.ts`", "Numbered Backtick Format"],
  ["1. **src/app.ts**", "Numbered Bold Format"],
])("numbered header %s permits intervening commentary", async (header, format) => {
  const input = [header + ": updated", "Explanation.", "", "```ts", "export {};", "```"].join("\n");
  const names: Array<{ name: string; format: string }> = [];
  const code: string[] = [];
  const parser = new StreamingMarkdownParser({
    onFileNameChange: async (name, format) => { names.push({ name, format }); },
    onCodeLine: async (line) => { code.push(line); },
  });
  for (const character of input) await parser.processChunk(character);
  await parser.flushRemaining();
  expect(parseMarkdownFiles(input)).toEqual({ files: { "src/app.ts": "export {};" }, format });
  expect(names).toEqual([{ name: "src/app.ts", format }]);
  expect(code).toEqual(["export {};"]);
});

test("streaming switches formats and ignores header-like lines inside fences", async () => {
  const names: Array<{ name: string; format: string }> = [];
  const code: string[] = [];
  const deleted: string[] = [];
  const parser = new StreamingMarkdownParser({
    onFileNameChange: async (name, format) => { names.push({ name, format }); },
    onCodeLine: async (line) => { code.push(line); },
    onFileDelete: async (name) => { deleted.push(name); },
  });
  const input = [
    "### File: **index.js**", "```", "# fake.js", "### fake.ts", "fake.css:", "```",
    "styles.css:", "", "```", "```",
    "### Updated **src/app.ts**", "```", "keep", "```",
    "2. **data.csv**", "```", "1,2", "```",
  ].join("\n");
  for (const character of input) await parser.processChunk(character);
  await parser.flushRemaining();
  expect(names).toEqual([
    { name: "index.js", format: "File Bold Format" },
    { name: "styles.css", format: "Colon Format" },
    { name: "src/app.ts", format: "Bold Format" },
    { name: "data.csv", format: "Numbered Bold Format" },
  ]);
  expect(code).toEqual(["# fake.js", "### fake.ts", "fake.css:", "keep", "1,2"]);
  expect(deleted).toEqual(["styles.css"]);
});
