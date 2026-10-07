import { expect, test } from "vitest";
import { parseMarkdownFiles } from "./parseMarkdownFiles";

// Tests for parseMarkdownFiles function with different formats
test("parseMarkdownFiles detects Bold Format and parses files", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

**script.js**

\`\`\`javascript
// JavaScript content
\`\`\`

**styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Bold Format with extra text and parses files", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

**script.js** (some commentary)

\`\`\`javascript
// JavaScript content
\`\`\`

**styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles handles Bold Format with parentheses and extra text", () => {
  const markdownString = `
**renderArcs.js (New file)**

\`\`\`javascript
// JavaScript content for renderArcs
\`\`\`

**utils.js (Modified)**

\`\`\`javascript
// JavaScript content for utils
\`\`\`

**config.json (Configuration file)**

\`\`\`json
{ "version": "1.0" }
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "renderArcs.js": "// JavaScript content for renderArcs",
    "utils.js": "// JavaScript content for utils",
    "config.json": '{ "version": "1.0" }',
  });
});

test("parseMarkdownFiles detects Backtick-Heading Format and parses files", () => {
  const markdownString = `
### \`index.html\`

\`\`\`html
<!-- HTML content -->
\`\`\`

### \`script.js\`

\`\`\`javascript
// JavaScript content
\`\`\`

### \`styles.css\`

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Backtick-Heading Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Standard Heading Format and parses files", () => {
  const markdownString = `
### index.html

\`\`\`html
<!-- HTML content -->
\`\`\`

### script.js

\`\`\`javascript
// JavaScript content
\`\`\`

### styles.css

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Standard Heading Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Colon Format and parses files", () => {
  const markdownString = `
index.html:
\`\`\`html
<!-- HTML content -->
\`\`\`

script.js:
\`\`\`javascript
// JavaScript content
\`\`\`

styles.css:
\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Colon Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Bold Format and parses files", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

**script.js**

\`\`\`javascript
// JavaScript content
\`\`\`

**styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects File Bold Format and parses files", () => {
  const markdownString = `
### File: **index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

### File: **script.js**

\`\`\`javascript
// JavaScript content
\`\`\`

### File: **styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("File Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Heading Bold Format and parses files", () => {
  const markdownString = `
### **index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

### **script.js**

\`\`\`javascript
// JavaScript content
\`\`\`

### **styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Heading Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Numbered Bold Format and parses files", () => {
  const markdownString = `
1. **index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

2. **style.css**
This file contains the CSS for styling the scatter plot.

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Numbered Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "style.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Numbered Bold Format with extra text", () => {
  const markdownString = `

   To create a scatter plot with D3.js, follow these steps:

1. **index.html**: In your HTML file, include the three required files for D3.js:

\`\`\`html
<!-- HTML content -->
\`\`\`

2. **style.css**: Style the plot as needed. Here's a minimal style to give it a white background and add some padding:

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Numbered Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "style.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Numbered Backtick Format and parses files", () => {
  const markdownString = `
### 1. \`index.html\`

\`\`\`html
<!-- HTML content -->
\`\`\`

### 2. \`style.css\`
This file contains the CSS for styling the scatter plot.

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Numbered Backtick Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "style.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles detects Hash Format and parses files", () => {
  const markdownString = `
# index.html
\`\`\`html
<!-- HTML content -->
\`\`\`

# script.js
\`\`\`javascript
// JavaScript content
\`\`\`

# styles.css
\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Hash Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

test("parseMarkdownFiles should use final version", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- Old HTML content -->
\`\`\`

And then we do some work on it and...

**index.html**

\`\`\`html
<!-- New HTML content -->
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- New HTML content -->",
  });
});

const content = ` To create a scatter plot with D3.js, follow these steps:

1. **index.html**: In your HTML file, include the three required files for D3.js:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Scatter Plot with D3.js</title>
  <script src="https://d3js.org/d3.v6.min.js"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="scatter-plot"></div>
  <script src="index.js"></script>
</body>
</html>
\`\`\`

2. **styles.css**: Style the plot as needed. Here's a minimal style to give it a white background and add some padding:

\`\`\`css
/* styles.css */
body, html {
  height: 102%;
  padding: 0;
}

#scatter-plot {
  width: 100%;
  height: 100%;
} 
\`\`\`

3. **index.js**: In your JavaScript file, load data for the scatter plot (which can be from an API, CSV file, or the browser), create a SVG container, and define the plot. Here's an example that generates random data:

\`\`\`javascript
// index.js

d3.select("body")
  .append("div")
  .attr("id", "scatter-plot");

// Load data
const data = d3.randomN(500, (x, y) => ({x, y}));

// Create SVG container
const svg = d3.select("#scatter-plot")
  .append("svg")
  .attr("width", "100%")
  .attr("height", "100%");

// Scales X and Y axes
const xInfo = d3.scaleLinear()
  .domain(d3.extent(data, d => d.x))
  .range([0, svg.node().width]);
const yInfo = d3.scaleLinear()
  .domain(d3.extent(data, d => d.y))
  .range([svg.node().height, 0]);

// Create circles and color them based on their distances from the axes
svg.selectAll("circle")
  .data(data)
  .enter()
  .append("circle")
  .attr("cx", d => xInfo(d.x))
  .attr("cy", d => yInfo(d.y))
  .attr("r", 4)
  .attr("fill", "steelblue")
  .on("mousemove", function(event, d) {
    // Change color of circles based on their distances from the axes
    const xDistance = Math.abs(data.average(d => d.x) - d3.mouse(this).x);
    const yDistance = Math.abs(data.average(d => d.y) - d3.mouse(this).y);
    d3.select(this)
      .style("fill", \`steelblue\${yDistance > xDistance ? "20%" : ""}\`);
  });
\`\`\`

This code generates a scatter plot of 500 circles with random coordinates between 0 and 100, and colors each circle with a gradient from blue to red based on its distance from the X and Y axes. When you move the mouse over a circle, its color changes based on its distance from the moving mouse pointer.
`;

test("parseMarkdownFiles work with real output from Mistral", () => {
  const { files, format } = parseMarkdownFiles(content);
  // console.log(JSON.stringify(files, null, 2));
  expect(format).toBe("Numbered Bold Format");
  expect(files).toEqual({
    "index.html":
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Scatter Plot with D3.js</title>\n  <script src="https://d3js.org/d3.v6.min.js"></script>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div id="scatter-plot"></div>\n  <script src="index.js"></script>\n</body>\n</html>',
    "styles.css":
      "/* styles.css */\nbody, html {\n  height: 102%;\n  padding: 0;\n}\n\n#scatter-plot {\n  width: 100%;\n  height: 100%;\n}",
    "index.js":
      '// index.js\n\nd3.select("body")\n  .append("div")\n  .attr("id", "scatter-plot");\n\n// Load data\nconst data = d3.randomN(500, (x, y) => ({x, y}));\n\n// Create SVG container\nconst svg = d3.select("#scatter-plot")\n  .append("svg")\n  .attr("width", "100%")\n  .attr("height", "100%");\n\n// Scales X and Y axes\nconst xInfo = d3.scaleLinear()\n  .domain(d3.extent(data, d => d.x))\n  .range([0, svg.node().width]);\nconst yInfo = d3.scaleLinear()\n  .domain(d3.extent(data, d => d.y))\n  .range([svg.node().height, 0]);\n\n// Create circles and color them based on their distances from the axes\nsvg.selectAll("circle")\n  .data(data)\n  .enter()\n  .append("circle")\n  .attr("cx", d => xInfo(d.x))\n  .attr("cy", d => yInfo(d.y))\n  .attr("r", 4)\n  .attr("fill", "steelblue")\n  .on("mousemove", function(event, d) {\n    // Change color of circles based on their distances from the axes\n    const xDistance = Math.abs(data.average(d => d.x) - d3.mouse(this).x);\n    const yDistance = Math.abs(data.average(d => d.y) - d3.mouse(this).y);\n    d3.select(this)\n      .style("fill", `steelblue${yDistance > xDistance ? "20%" : ""}`);\n  });',
  });
});

// Test that parses correctly when the format is 'bold' and the input matches 'Bold Format'
test("parseMarkdownFiles parses Bold Format when format is specified as 'bold'", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

**script.js**

\`\`\`javascript
// JavaScript content
\`\`\`

**styles.css**

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

// Test that returns empty files when format is 'bold' but the input does not match any format
test("parseMarkdownFiles returns empty files when format is 'bold' but input does not match", () => {
  const markdownString = `
This is just prose with no file headers.

Another paragraph of text.
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Unknown Format");
  expect(files).toEqual({});
});

// Test that throws an error when an unsupported format is specified
test("parseMarkdownFiles throws error when an unsupported format is specified", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`
  `;
  expect(() =>
    parseMarkdownFiles(markdownString, "unsupported-format"),
  ).toThrow("Unsupported format: unsupported-format");
});

// Test that parses correctly when the format is 'bold' and there are duplicate file names
test("parseMarkdownFiles handles duplicate file names in Bold Format when format is specified", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- Old HTML content -->
\`\`\`

**index.html**

\`\`\`html
<!-- New HTML content -->
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- New HTML content -->",
  });
});

// Test that parses correctly when additional text is present between code blocks in Bold Format
test("parseMarkdownFiles parses Bold Format with additional text when format is specified", () => {
  const markdownString = `
**index.html**

\`\`\`html
<!-- HTML content -->
\`\`\`

Some additional description or instructions.

**script.js**

\`\`\`javascript
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
  });
});

// Test a backtick-only header line followed by a fenced code block
test("parseMarkdownFiles detects Backtick Format and parses files", () => {
  const markdownString = `
\`index.html\`

\`\`\`html
<!-- HTML content -->
\`\`\`

\`script.js\`

\`\`\`javascript
// JavaScript content
\`\`\`

\`styles.css\`

\`\`\`css
/* CSS content */
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Backtick Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
    "styles.css": "/* CSS content */",
  });
});

// Test a bold-wrapped name that itself contains backticks
test("parseMarkdownFiles detects Bold Format with inner backticks", () => {
  const markdownString = `
**\`index.html\`**

\`\`\`html
<!-- HTML content -->
\`\`\`

**\`script.js\`**

\`\`\`javascript
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({
    "index.html": "<!-- HTML content -->",
    "script.js": "// JavaScript content",
  });
});

// Auto-detect still reports Bold Format for a plain bold header
test("parseMarkdownFiles auto-detects Bold Format for a plain bold header", () => {
  const markdownString = `
**index.js**

\`\`\`js
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString);
  expect(format).toBe("Bold Format");
  expect(files).toEqual({ "index.js": "// JavaScript content" });
});

// Explicit "bold" format with a normal bold input still parses via the bold path
test("parseMarkdownFiles parses normal bold input via the bold path when format is 'bold'", () => {
  const markdownString = `
**index.js**

\`\`\`js
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Bold Format");
  expect(files).toEqual({ "index.js": "// JavaScript content" });
});

// Explicit "bold" format falls back to auto-detect for a standard heading
test("parseMarkdownFiles falls back to auto-detect for a heading header when format is 'bold'", () => {
  const markdownString = `
### index.js

\`\`\`js
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Standard Heading Format");
  expect(files).toEqual({ "index.js": "// JavaScript content" });
});

// Explicit "bold" format falls back to auto-detect for a backtick-only header
test("parseMarkdownFiles falls back to auto-detect for a backtick header when format is 'bold'", () => {
  const markdownString = `
\`index.js\`

\`\`\`js
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Backtick Format");
  expect(files).toEqual({ "index.js": "// JavaScript content" });
});

// Explicit "bold" format falls back to auto-detect for a colon header
test("parseMarkdownFiles falls back to auto-detect for a colon header when format is 'bold'", () => {
  const markdownString = `
index.js:
\`\`\`js
// JavaScript content
\`\`\`
  `;
  const { files, format } = parseMarkdownFiles(markdownString, "bold");
  expect(format).toBe("Colon Format");
  expect(files).toEqual({ "index.js": "// JavaScript content" });
});
