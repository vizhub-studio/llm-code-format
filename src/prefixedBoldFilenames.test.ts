import { expect, test } from "vitest";
import { parseMarkdownFiles } from "./parseMarkdownFiles";
import { StreamingMarkdownParser } from "./streamingParser";

const format = "Bold Format";
const fence = "```";
const code = "const x = 1;";
const block = (header: string, contents = code) =>
  [header, "", fence + "js", contents, fence].join("\n");

const validHeaders = [
  ["### Updated **renderRain.js**", "renderRain.js"],
  ["### Modified **index.ts**", "index.ts"],
  ["### New file: **App.tsx**", "App.tsx"],
  ["### Updated **src/utils.js**", "src/utils.js"],
  ["### Updated **config.json**", "config.json"],
  ["## Added **data.csv**", "data.csv"],
  ["# Revised: **src/chart.ts**", "src/chart.ts"],
  ["#### Changed file: **styles.css**", "styles.css"],
  ["Updated **index.html**", "index.html"],
  ["### updated **chart.js**", "chart.js"],
  ["  ###\tModified\t**src/chart.ts**  ", "src/chart.ts"],
  ["### Updated: **`src/app.ts`**", "src/app.ts"],
  ["### Modified **config.json (new file)**", "config.json"],
  ["### Updated **index.js** (with changes)", "index.js"],
  ["### Updated **index.js**: improved rendering", "index.js"],
  ["### Added **.gitignore**", ".gitignore"],
  ["### New file **src/Makefile**", "src/Makefile"],
  ["### Updated **file-name.test.js**", "file-name.test.js"],
] as const;

const rejectedHeaders = [
  "### Updated **Important notes**",
  "### Here is **the solution**",
  "### Why **index.js** matters",
  "Read **index.js** for details",
  "### Updated **index.js** and **style.css**",
  "### Updated **index.js",
  "### Updated **https://example.com/index.js**",
  "### Updated **../index.js**",
  "### Updated **src/../index.js**",
  "### Updated **/etc/passwd**",
  "### Updated **src/**",
  "### Updated **not a file.js**",
  "### Updated **Summary**",
  "### Updated ****",
];

async function stream(chunks: string[]) {
  const names: Array<{ name: string; format: string }> = [];
  const lines: string[] = [];
  const prose: string[] = [];
  const deleted: string[] = [];
  const parser = new StreamingMarkdownParser({
    onFileNameChange: async (name, format) => {
      names.push({ name, format });
    },
    onCodeLine: async (line) => {
      lines.push(line);
    },
    onNonCodeLine: async (line) => {
      prose.push(line);
    },
    onFileDelete: async (name) => {
      deleted.push(name);
    },
  });
  for (const chunk of chunks) await parser.processChunk(chunk);
  await parser.flushRemaining();
  return { names, lines, prose, deleted };
}

test.each(validHeaders)("batch parses %s as %s", (header, name) => {
  const expected = { files: { [name]: code }, format };
  expect(parseMarkdownFiles(block(header))).toEqual(expected);
  expect(parseMarkdownFiles(block(header), "bold")).toEqual(expected);
});

test.each(validHeaders)("streaming parses %s as %s", async (header, name) => {
  const input = block(header);
  const result = await stream([input]);
  expect(result.names).toEqual([{ name, format }]);
  expect(result.lines).toEqual([code]);
  expect(result.deleted).toEqual([]);
  // Exercise every two-chunk split, including within the prefix, bold
  // delimiters, filename, opening fence, code, and closing fence.
  for (let split = 0; split <= input.length; split++) {
    expect(await stream([input.slice(0, split), input.slice(split)])).toEqual(
      result,
    );
  }
  expect(await stream(Array.from(input))).toEqual(result);
});

test.each(rejectedHeaders)("batch rejects %s", (header) => {
  expect(parseMarkdownFiles(block(header))).toEqual({
    files: {},
    format: "Unknown Format",
  });
  expect(parseMarkdownFiles(block(header), "bold").files).toEqual({});
});

test.each(rejectedHeaders)("streaming rejects %s", async (header) => {
  const result = await stream(Array.from(block(header, "")));
  expect(result.names).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.prose).toContain(header);
});

test("batch and streaming preserve order and filenames in a mixed bold response", async () => {
  const input = [
    block("**index.js**", "first"),
    block("### Updated **src/chart.ts**", "second"),
    block("### New file: **style.css**", "third"),
    block("**index.js**", "last"),
  ].join("\n\n");
  expect(parseMarkdownFiles(input)).toEqual({
    files: {
      "index.js": "last",
      "src/chart.ts": "second",
      "style.css": "third",
    },
    format,
  });
  const result = await stream(Array.from(input));
  expect(result.names).toEqual([
    { name: "index.js", format },
    { name: "src/chart.ts", format },
    { name: "style.css", format },
    { name: "index.js", format },
  ]);
  expect(result.lines).toEqual(["first", "second", "third", "last"]);
  expect(result.deleted).toEqual([]);
});

test("headers inside a code fence remain literal code", async () => {
  const body = "### Updated **fake.js**";
  const input = block("### Updated **real.md**", body);
  expect(parseMarkdownFiles(input).files).toEqual({ "real.md": body });
  const result = await stream(Array.from(input));
  expect(result.names).toEqual([{ name: "real.md", format }]);
  expect(result.lines).toEqual([body]);
  expect(result.deleted).toEqual([]);
});

test("batch does not rewrite header-like text inside longer or tilde fences", () => {
  const nested = block("### Updated **fake.js**");
  for (const outer of ["````", "~~~"]) {
    const input = [outer, nested, outer].join("\n");
    expect(parseMarkdownFiles(input).files).toEqual({});
  }
});

test("prefixed headers preserve explicit deletion and non-deletion behavior", async () => {
  const input = [
    block("### Updated **keep.js**", "keep"),
    block("### Updated **remove.js**", ""),
    block("### Modified **empty.css**", " \t"),
    block("### New file **other.js**", "other"),
  ].join("\n\n");
  expect(parseMarkdownFiles(input).files).toEqual({
    "keep.js": "keep",
    "remove.js": "",
    "empty.css": "",
    "other.js": "other",
  });
  const result = await stream(Array.from(input));
  expect(result.deleted).toEqual(["remove.js", "empty.css"]);
  expect(result.names.map(({ name }) => name)).toEqual([
    "keep.js",
    "remove.js",
    "empty.css",
    "other.js",
  ]);
});

test("incomplete streams do not trigger deletion", async () => {
  const header = "### Updated **index.js**";
  expect(parseMarkdownFiles(header).files).toEqual({});
  expect((await stream([header])).names).toEqual([
    { name: "index.js", format },
  ]);
  const incomplete = header + "\n" + fence + "js\n";
  expect(parseMarkdownFiles(incomplete).files).toEqual({});
  const result = await stream(Array.from(incomplete));
  expect(result.names).toEqual([{ name: "index.js", format }]);
  expect(result.deleted).toEqual([]);
});

test("unprefixed formats retain their original labels", () => {
  expect(parseMarkdownFiles(block("### File: **index.js**")).format).toBe(
    "File Bold Format",
  );
  expect(parseMarkdownFiles(block("### **index.js**")).format).toBe(
    "Heading Bold Format",
  );
  expect(parseMarkdownFiles(block("**index.js**")).format).toBe(format);
});
