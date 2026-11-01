# CV

Personal site with an English ATS-friendly CV. `src/cv/cv.yaml` is the single source of truth for career facts; `src/site/site.yaml` holds only what is specific to the home page. `npm run build` renders the home page (`/`), the CV (`/cv/`), and the PDF (`/cv.pdf`), and runs the ATS checks. A push to `main` publishes to GitHub Pages only when the build is green.

Setup: `npm ci && npx playwright install chromium`

Links between pages stay relative, because the site is served under a `/cv/` base path.

## Truthfulness

Every fact traces back to the source PDF or to something the user told you. When a metric, date, or technology is missing, ask the user and leave it out until they answer.

## Privacy

The repo is public, so the YAML files hold email, city, and profile links only. The schemas reject unknown fields, which keeps phone and postal address out; keep that strictness. Source PDFs and tailored versions live in `private/`, which is gitignored. Job offers stay there too.

Naval Group is defence work: its entry carries no `stack`, and the user approves any technical detail added to it.

## Writing rules

- Write bullets as action + scope + measurable impact, opening with a past-tense verb (present tense for the current job).
- Use the exact market term and spell out acronyms once: "Service Level Objectives (SLOs)".
- Keep 3 to 5 bullets for recent jobs and 1 to 2 for jobs older than 10 years.
- Every skill listed appears in a bullet or project where possible, so that it has evidence.
- Keep the CV template single-column with plain text and these headings: Summary, Experience, Projects, Skills, Education, Certifications, Languages.

## Workflows

**Import** (PDF in `private/`): extract the PDF into `src/cv/cv.yaml`, dropping phone and postal address. Done when `npm run build` is green and every job, date, and bullet of the PDF is accounted for. Report ambiguous or missing items as questions.

**Improve**: rewrite bullets against the writing rules, one job at a time, asking the user for the missing numbers. Done when every bullet shows an impact or the user has confirmed none is available.

**Audit**: run the build, read `dist.extracted.txt` as an ATS would, then review as a recruiter for a Tech Lead, Platform Engineer, or SRE role. Report findings ranked by hiring impact and leave the YAML unchanged.

**Tailor** (job offer in `private/<company>/offer.md`): copy `src/cv/cv.yaml` to `private/<company>/cv.yaml`, reorder and rephrase its existing facts to mirror the offer's vocabulary, then run `npm run build -- private/<company>/cv.yaml private/<company>`. Done when the build is green and you have listed the offer's requirements the CV cannot truthfully cover.

`dist.extracted.txt` is what a parser sees: check it after any CV template change. Page count can differ between macOS and CI because of fonts, so the CI build is the one that counts.
