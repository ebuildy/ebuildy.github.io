// Usage: node scripts/build.mjs [input=cv.yaml] [outDir=dist]
// Validates the YAML, renders HTML, prints the PDF, then runs the ATS checks.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import nunjucks from "nunjucks";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright";
import { parse } from "yaml";

const MAX_PAGES = 2;
const SECTIONS = ["Summary", "Experience", "Skills", "Education"];
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

const [input = "cv.yaml", outDir = "dist"] = process.argv.slice(2);

function fail(title, problems) {
  console.error(`✗ ${title}\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

function loadCv() {
  const cv = parse(readFileSync(input, "utf8"));
  const schema = JSON.parse(readFileSync("cv.schema.json", "utf8"));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  if (!validate(cv)) {
    fail(
      `${input} does not match cv.schema.json`,
      validate.errors.map((e) => `${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`),
    );
  }
  return cv;
}

function formatDate(date) {
  const [year, month] = String(date).split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

const displayUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function renderHtml(cv, pdfName) {
  const env = nunjucks.configure("templates", { autoescape: true });
  env.addFilter("date", formatDate);
  env.addFilter("displayUrl", displayUrl);
  return env.render("cv.njk", { cv, pdfName, css: readFileSync("templates/cv.css", "utf8") });
}

async function printPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${join(process.cwd(), htmlPath)}`);
    await page.pdf({ path: pdfPath, format: "A4", printBackground: false, tagged: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

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

const cv = loadCv();
const pdfName = `${cv.basics.name.replace(/\s+/g, "-")}-CV.pdf`;
const htmlPath = join(outDir, "index.html");
const pdfPath = join(outDir, pdfName);

mkdirSync(outDir, { recursive: true });
writeFileSync(htmlPath, renderHtml(cv, pdfName));
await printPdf(htmlPath, pdfPath);

const pdf = await readPdf(pdfPath);
writeFileSync(join(outDir, "extracted.txt"), pdf.text);

const problems = checkAts(cv, pdf);
if (problems.length) fail("ATS checks failed", problems);

console.log(`✓ ${pdfPath} (${pdf.pages} page(s)), ATS checks passed`);
