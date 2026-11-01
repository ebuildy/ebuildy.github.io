// Usage: node scripts/check.mjs [dataYaml outDir]
// Runs the ATS checks on a built PDF and writes what a parser sees to <outDir>.extracted.txt.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parse } from "yaml";

const MAX_PAGES = 2;
const SECTIONS = ["Summary", "Experience", "Skills", "Education"];

const [input = "src/data.yaml", outDir = "dist"] = process.argv.slice(2);

async function readPdf(pdfPath) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), verbosity: 0 }).promise;
  const { info } = await doc.getMetadata();
  let text = "";
  let images = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str + (item.hasEOL ? "\n" : "")).join("") + "\n";
    const ops = await page.getOperatorList();
    images += ops.fnArray.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject).length;
  }
  return { pages: doc.numPages, title: info.Title, text, images };
}

function checkAts(cv, pdf) {
  const problems = [];
  const flat = pdf.text.replace(/\s+/g, " ");
  if (pdf.pages > MAX_PAGES) problems.push(`${pdf.pages} pages, maximum is ${MAX_PAGES}`);
  if (pdf.images > 0) problems.push(`${pdf.images} image(s) in the PDF`);
  if (!pdf.title?.includes(cv.basics.name)) problems.push(`PDF title "${pdf.title}" lacks the name`);
  if (/[ﬀ-ﬆ]/.test(pdf.text)) problems.push("ligature glyphs in the extracted text");

  const required = [cv.basics.name, cv.basics.email, ...cv.work.flatMap((w) => [w.name, w.position])];
  for (const value of required) {
    if (!flat.includes(value)) problems.push(`"${value}" missing from the extracted text`);
  }

  // Section headings sit alone on a line, so body text cannot satisfy this.
  const lines = pdf.text.split("\n").map((line) => line.trim());
  const positions = SECTIONS.map((name) => lines.indexOf(name));
  SECTIONS.forEach((name, i) => {
    if (positions[i] === -1) problems.push(`section "${name}" missing from the extracted text`);
  });
  if (!problems.length && positions.some((p, i) => i > 0 && p < positions[i - 1])) {
    problems.push(`sections out of order, expected ${SECTIONS.join(" > ")}`);
  }
  return problems;
}

const cv = parse(readFileSync(input, "utf8"));
const pdf = await readPdf(join(outDir, "cv.pdf"));
writeFileSync(`${outDir}.extracted.txt`, pdf.text);

const problems = checkAts(cv, pdf);
if (problems.length) {
  console.error(`✗ ATS checks failed\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

console.log(`✓ ${outDir}/cv.pdf (${pdf.pages} page(s)), ATS checks passed`);
