// Builds docs/user-guide/JSONsetRight-User-Guide.html from the Markdown chapters in docs/user-guide.
// Run with: npm run docs
//
// The Markdown files are the source; the HTML page is generated, so edit the .md files and rebuild.
// The page is self-contained (no internet needed), has a table of contents, follows the Windows
// light/dark setting, and prints cleanly.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

const dir = join(process.cwd(), "docs", "user-guide");
const output = join(dir, "JSONsetRight-User-Guide.html");
const version = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version;

// README.md is the introduction; chapters are 01-....md, 02-....md, ... in order.
const files = ["README.md", ...readdirSync(dir).filter((f) => /^\d\d-.+\.md$/.test(f)).sort()];

/** GitHub-style heading anchor: "Where JSONsetRight keeps its data" -> "where-jsonsetright-keeps-its-data". */
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const chapterId = (file) => (file === "README.md" ? "introduction" : file.replace(/\.md$/, ""));

const toc = [];
const sections = files.map((file) => {
  const id = chapterId(file);
  let html = marked.parse(readFileSync(join(dir, file), "utf8"));

  // Give headings ids that are unique across the whole page: chapter id + heading slug.
  const headings = [];
  html = html.replace(/<h([1-3])>(.*?)<\/h\1>/g, (_, level, inner) => {
    const anchor = level === "1" ? id : `${id}--${slug(inner)}`;
    headings.push({ level: Number(level), anchor, text: inner.replace(/<[^>]+>/g, "") });
    return `<h${level} id="${anchor}">${inner}</h${level}>`;
  });

  // Links between chapters ("10-safety.md#backups") become links within this page.
  html = html.replace(/href="(?:\.\/)?((?:\d\d-[\w-]+)|README)\.md(?:#([\w-]+))?"/g, (_, target, anchor) => {
    const targetId = chapterId(`${target}.md`);
    return `href="#${anchor ? `${targetId}--${anchor}` : targetId}"`;
  });
  // External links open in a new browser tab.
  html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
  // Tables scroll sideways on narrow screens instead of overflowing.
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");

  toc.push({ id, title: headings[0]?.text ?? id, sub: headings.filter((h) => h.level === 2) });
  return `<section class="chapter" id="section-${id}">\n${html}</section>`;
});

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tocHtml = toc
  .map(
    (c) =>
      `<li><a href="#${c.id}">${escape(c.title)}</a>${
        c.sub.length ? `<ul>${c.sub.map((s) => `<li><a href="#${s.anchor}">${escape(s.text)}</a></li>`).join("")}</ul>` : ""
      }</li>`,
  )
  .join("\n");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JSONsetRight User Guide</title>
<meta name="description" content="How to use JSONsetRight ${version}, a Windows app for editing JSON files safely.">
<style>
:root {
  --bg: #ffffff; --bg-side: #f5f6f8; --text: #1f2328; --muted: #59636e; --border: #d8dee4;
  --accent: #0a64c2; --code-bg: #f3f4f6; --note-bg: #eef5fd; --row: #f8f9fa;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1e1e1e; --bg-side: #252526; --text: #e6e6e6; --muted: #a0a0a0; --border: #3c3c3c;
    --accent: #4aa3ff; --code-bg: #2d2d2d; --note-bg: #1c2b3a; --row: #242424;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { scroll-padding-top: 16px; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 "Segoe UI", system-ui, sans-serif; }
a { color: var(--accent); }
.layout { display: flex; min-height: 100vh; }
nav.toc {
  position: sticky; top: 0; align-self: flex-start; width: 290px; height: 100vh; overflow: auto; flex: none;
  padding: 20px 16px; background: var(--bg-side); border-right: 1px solid var(--border); font-size: 14px;
}
nav.toc .brand { font-size: 20px; font-weight: 700; margin: 0 0 2px; }
nav.toc .version { color: var(--muted); margin: 0 0 16px; font-size: 13px; }
nav.toc ul { list-style: none; margin: 0; padding: 0; }
nav.toc > ul > li { margin: 6px 0; }
nav.toc > ul > li > a { font-weight: 600; color: var(--text); text-decoration: none; }
nav.toc ul ul { margin: 2px 0 8px 10px; padding-left: 8px; border-left: 1px solid var(--border); }
nav.toc ul ul a { color: var(--muted); text-decoration: none; }
nav.toc a:hover { color: var(--accent); }
main { flex: 1; min-width: 0; padding: 24px 48px 80px; max-width: 920px; }
.chapter { padding-bottom: 24px; border-bottom: 1px solid var(--border); margin-bottom: 32px; }
h1 { font-size: 30px; margin: 8px 0 12px; }
h2 { font-size: 22px; margin: 28px 0 8px; padding-top: 4px; }
h3 { font-size: 18px; margin: 22px 0 6px; }
p, li { max-width: 72ch; }
code { font-family: "Cascadia Code", Consolas, monospace; font-size: 0.9em; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
pre { background: var(--code-bg); padding: 12px 14px; border-radius: 6px; overflow: auto; line-height: 1.35; }
pre code { padding: 0; background: none; font-size: 13px; }
.table-wrap { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; font-size: 15px; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--bg-side); }
tbody tr:nth-child(even) td { background: var(--row); }
blockquote { margin: 14px 0; padding: 8px 14px; background: var(--note-bg); border-left: 4px solid var(--accent); border-radius: 0 6px 6px 0; }
blockquote p { margin: 4px 0; }
.top-link { font-size: 13px; }
footer { color: var(--muted); font-size: 13px; }
@media (max-width: 800px) {
  .layout { display: block; }
  nav.toc { position: static; width: auto; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 16px; }
}
@media print {
  nav.toc, .top-link { display: none; }
  main { max-width: none; padding: 0; }
  body { font-size: 11pt; background: #fff; color: #000; }
  .chapter { border: none; break-before: page; }
  .chapter:first-of-type { break-before: auto; }
  a { color: inherit; text-decoration: none; }
  pre, table, blockquote { break-inside: avoid; }
}
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="Contents">
<p class="brand">JSONsetRight</p>
<p class="version">User Guide · version ${version}</p>
<ul>
${tocHtml}
</ul>
</nav>
<main>
${sections.join("\n<p class=\"top-link\"><a href=\"#introduction\">↑ Back to top</a></p>\n")}
<footer>JSONsetRight ${version} User Guide. Generated from the Markdown files in docs/user-guide.</footer>
</main>
</div>
</body>
</html>
`;

writeFileSync(output, page, "utf8");
console.log(`Wrote ${output} (${files.length} sections)`);
