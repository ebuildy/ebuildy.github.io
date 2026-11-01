// Usage: node scripts/build.mjs [dataYaml outDir]
// Validates the YAML, renders the CV page and prints the PDF.
// Without arguments it also renders the home page. With them, it builds only that CV.
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import nunjucks from "nunjucks";
import { chromium } from "playwright";
import { parse } from "yaml";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const SCHEMA = "src/data.schema.json";

const [input = "src/data.yaml", outDir = "dist"] = process.argv.slice(2);
const withSite = process.argv.length <= 2;

function loadData(path) {
  const data = parse(readFileSync(path, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  if (!validate(data)) {
    const problems = validate.errors.map((e) => `  - ${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`);
    console.error(`✗ ${path} does not match ${SCHEMA}\n${problems.join("\n")}`);
    process.exit(1);
  }
  return data;
}

function formatDate(date) {
  const [year, month] = String(date).split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

const displayUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function render(name, context) {
  const env = nunjucks.configure("src", { autoescape: true });
  env.addFilter("date", formatDate);
  env.addFilter("displayUrl", displayUrl);
  return env.render(`${name}/${name}.njk`, { ...context, css: readFileSync(`src/${name}/${name}.css`, "utf8") });
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

const cv = loadData(input);
const htmlPath = join(outDir, "cv", "index.html");
const pdfPath = join(outDir, "cv.pdf");

mkdirSync(join(outDir, "cv"), { recursive: true });
writeFileSync(htmlPath, render("cv", { cv }));
await printPdf(htmlPath, pdfPath);

if (withSite) {
  const jobs = cv.work.slice(0, cv.site.experience.limit);
  writeFileSync(join(outDir, "index.html"), render("site", { cv, site: cv.site, jobs }));
  copyFileSync("src/site/photo.jpg", join(outDir, "photo.jpg"));
  cpSync("src/site/logos", join(outDir, "logos"), { recursive: true });
}

console.log(`✓ built ${outDir}`);
