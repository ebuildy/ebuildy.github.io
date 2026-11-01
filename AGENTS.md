# CV

English ATS-friendly CV. `cv.yaml` is the single source of truth; `npm run build` turns it into a web page and a PDF and runs the ATS checks. A push to `main` publishes to GitHub Pages only when the build is green.

Setup: `npm ci && npx playwright install chromium`

## Truthfulness

Every fact in the CV traces back to the source PDF or to something the user told you. When a metric, date, or technology is missing, ask the user and leave it out until they answer.

## Privacy

The repo is public, so `cv.yaml` holds email, city, and profile links only. `cv.schema.json` rejects phone and postal address fields; keep that strictness. Source PDFs and tailored versions live in `private/`, which is gitignored. Job offers stay there too.

## Writing rules

- Write bullets as action + scope + measurable impact, opening with a past-tense verb (present tense for the current job).
- Use the exact market term and spell out acronyms once: "Service Level Objectives (SLOs)".
- Keep 3 to 5 bullets for recent jobs and 1 to 2 for jobs older than 10 years.
- Every skill listed appears in a bullet or project where possible, so that it has evidence.
- Keep the template single-column with plain text and these headings: Summary, Experience, Projects, Skills, Education, Certifications, Languages.

## Workflows

**Import** (PDF in `private/`): extract the PDF into `cv.yaml`, dropping phone and postal address. Done when `npm run build` is green and every job, date, and bullet of the PDF is accounted for. Report ambiguous or missing items as questions.

**Improve**: rewrite bullets against the writing rules, one job at a time, asking the user for the missing numbers. Done when every bullet shows an impact or the user has confirmed none is available.

**Audit**: run the build, read `dist/extracted.txt` as an ATS would, then review as a recruiter for a Senior DevOps, SRE, or Tech Lead role. Report findings ranked by hiring impact and leave `cv.yaml` unchanged.

**Tailor** (job offer in `private/<company>/offer.md`): copy `cv.yaml` to `private/<company>/cv.yaml`, reorder and rephrase its existing facts to mirror the offer's vocabulary, then run `npm run build -- private/<company>/cv.yaml private/<company>`. Done when the build is green and you have listed the offer's requirements the CV cannot truthfully cover.

The build's `extracted.txt` is what a parser sees: check it after any template change. Page count can differ between macOS and CI because of fonts, so the CI build is the one that counts.
