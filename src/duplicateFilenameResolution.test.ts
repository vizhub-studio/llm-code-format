import { expect, test } from "vitest";
import { parseMarkdownFiles } from "./index";
import type {
  DuplicateFilenameResolution,
  ParseMarkdownFilesOptions,
} from "./index";

const fence = "\x60\x60\x60";
const block = (header: string, code: string) =>
  [header, "", fence + "javascript", code, fence].join("\n");

const formats = [
  [
    "backtick-heading",
    "Backtick-Heading Format",
    (name: string, _n: number) => "### \x60" + name + "\x60",
  ],
  [
    "backtick",
    "Backtick Format",
    (name: string, _n: number) => "\x60" + name + "\x60",
  ],
  [
    "file-bold",
    "File Bold Format",
    (name: string, _n: number) => "### File: **" + name + "**",
  ],
  [
    "numbered-backtick",
    "Numbered Backtick Format",
    (name: string, n: number) => "### " + n + ". \x60" + name + "\x60",
  ],
  [
    "heading-bold",
    "Heading Bold Format",
    (name: string, _n: number) => "### **" + name + "**",
  ],
  [
    "standard-heading",
    "Standard Heading Format",
    (name: string, _n: number) => "### " + name,
  ],
  ["colon", "Colon Format", (name: string, _n: number) => name + ":"],
  ["bold", "Bold Format", (name: string, _n: number) => "**" + name + "**"],
  ["hash", "Hash Format", (name: string, _n: number) => "# " + name],
  [
    "numbered-bold",
    "Numbered Bold Format",
    (name: string, n: number) => n + ". **" + name + "**",
  ],
] as const;

const policies = [undefined, "last", "first", "longest"] as const;
for (const [key, label, header] of formats) {
  // Three occurrences, interleaved with other files, plus tie and empty cases.
  const entries = [
    ["src/app.js", "first"],
    ["other.js", "untouched"],
    ["src/app.js", "middle and longest"],
    ["nested/app.js", "distinct path"],
    ["src/app.js", "last"],
    ["tie.js", "abc"],
    ["tie.js", "xyz"],
    ["empty-last.js", "nonempty"],
    ["empty-last.js", ""],
    ["empty-first.js", ""],
    ["empty-first.js", "new content"],
    ["all-empty.js", ""],
    ["all-empty.js", "  "],
  ] as const;
  const markdown = entries
    .map(([name, code], n) => block(header(name, n + 1), code))
    .join("\n\n");
  for (const policy of policies) {
    for (const explicit of [false, true]) {
      test(
        key +
          " / " +
          (policy ?? "default") +
          " / " +
          (explicit ? "explicit" : "auto"),
        () => {
          const options: ParseMarkdownFilesOptions | undefined =
            policy === undefined ? undefined : { duplicateResolution: policy };
          const result = parseMarkdownFiles(
            markdown,
            explicit ? key : undefined,
            options,
          );
          const first = policy === "first";
          const longest = policy === "longest";
          expect(result).toEqual({
            format: label,
            files: {
              "src/app.js": first
                ? "first"
                : longest
                  ? "middle and longest"
                  : "last",
              "other.js": "untouched",
              "nested/app.js": "distinct path",
              "tie.js": first || longest ? "abc" : "xyz",
              "empty-last.js": first || longest ? "nonempty" : "",
              "empty-first.js": first ? "" : "new content",
              "all-empty.js": "",
            },
          });
        },
      );
    }
  }
}

const bold = (name: string, code: string) => block("**" + name + "**", code);
const parse = (markdown: string, policy: DuplicateFilenameResolution) =>
  parseMarkdownFiles(markdown, "bold", { duplicateResolution: policy });

test("longest protects a complete React component from a later explanatory snippet", () => {
  const complete =
    "import React from 'react';\nexport default function App() { return <div>Hello</div>; }";
  const snippet = "import { sum } from 'd3';";
  const markdown =
    bold("App.jsx", complete) +
    "\n\n**App.jsx** needs D3's sum:\n\n" +
    fence +
    "jsx\n" +
    snippet +
    "\n" +
    fence;
  expect(parse(markdown, "longest").files["App.jsx"]).toBe(complete);
  expect(parse(markdown, "last").files["App.jsx"]).toBe(snippet);
});

test("normalization precedes resolution, including action prefixes and inner backticks", () => {
  const markdown = [
    bold("src/app.js (New file)", "short"),
    bold("\x60src/app.js\x60", "the longest complete source"),
    block("### Updated **src/app.js**", "new"),
  ].join("\n\n");
  expect(parse(markdown, "longest").files).toEqual({
    "src/app.js": "the longest complete source",
  });
  expect(parse(markdown, "first").files).toEqual({ "src/app.js": "short" });
  expect(parse(markdown, "last").files).toEqual({ "src/app.js": "new" });
});

test("longest compares trimmed lengths, not outer padding", () => {
  const markdown = bold("a.js", "     x     ") + "\n\n" + bold("a.js", "abc");
  expect(parse(markdown, "longest").files["a.js"]).toBe("abc");
});

test("longest can pick the first, middle, or last occurrence; equal lengths keep first", () => {
  for (const [codes, expected] of [
    [["longest", "a", "b"], "longest"],
    [["a", "longest", "b"], "longest"],
    [["a", "b", "longest"], "longest"],
    [["abc", "xyz", "def"], "abc"],
  ] as const) {
    expect(
      parse(codes.map((code) => bold("a.js", code)).join("\n\n"), "longest")
        .files["a.js"],
    ).toBe(expected);
  }
});

test("explicit format fallback honors the policy", () => {
  const markdown =
    block("# a.js", "complete file") + "\n\n" + block("# a.js", "x");
  expect(parse(markdown, "longest")).toEqual({
    format: "Hash Format",
    files: { "a.js": "complete file" },
  });
});

test("existing batch format precedence is unchanged", () => {
  const markdown =
    block("### \x60a.js\x60", "preferred") +
    "\n\n" +
    bold("b.js", "a much longer unrelated file");
  expect(
    parseMarkdownFiles(markdown, undefined, { duplicateResolution: "longest" }),
  ).toEqual({
    format: "Backtick-Heading Format",
    files: { "a.js": "preferred" },
  });
  expect(parse(markdown, "longest")).toEqual({
    format: "Bold Format",
    files: { "b.js": "a much longer unrelated file" },
  });
});

test("empty options and omitted options preserve last-wins", () => {
  const markdown = bold("a.js", "original") + "\n\n" + bold("a.js", "");
  expect(parseMarkdownFiles(markdown, "bold", {})).toEqual(
    parseMarkdownFiles(markdown, "bold"),
  );
  expect(parseMarkdownFiles(markdown, "bold").files).toEqual({ "a.js": "" });
});

test("ordinary prose and unsupported formats preserve behavior for all policies", () => {
  for (const duplicateResolution of policies) {
    expect(
      parseMarkdownFiles("Just prose", undefined, { duplicateResolution }),
    ).toEqual({ files: {}, format: "Unknown Format" });
    expect(() =>
      parseMarkdownFiles("Just prose", "unsupported", { duplicateResolution }),
    ).toThrow("Unsupported format: unsupported");
  }
});

test("invalid runtime policy is rejected instead of silently selecting a winner", () => {
  expect(() =>
    parseMarkdownFiles("", undefined, {
      duplicateResolution: "invalid" as DuplicateFilenameResolution,
    }),
  ).toThrow("Unsupported duplicate resolution: invalid");
});

test("length policy does not merge snippets or conflate case-distinct names", () => {
  const markdown = [
    bold("a.js", "longer source"),
    bold("a.js", "x"),
    bold("A.js", "different case"),
  ].join("\n\n");
  expect(parse(markdown, "longest").files).toEqual({
    "a.js": "longer source",
    "A.js": "different case",
  });
});
