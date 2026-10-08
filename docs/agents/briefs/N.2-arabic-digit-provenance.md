# N.2 Fact-check numbers written in Arabic-Indic digits

**State:** ready · **Needs:** nothing
**File area:** `src/lib/provenance.ts`, `src/test/provenance.test.ts` (or the existing test file that covers it)
**Branch:** `agent/N.2-arabic-digits` · **PLAN.md:** Track N (found while writing the Phase 10 briefs)

## Goal
Tailored bullets, cover letters and recruiter notes must never contain a number the user's verified evidence doesn't
support (AGENTS.md). `numbersIn` in `src/lib/provenance.ts` matches only ASCII digits. NFKC normalisation doesn't
convert Arabic-Indic (U+0660–0669) or Extended Arabic-Indic / Persian (U+06F0–06F9) digits, so
`numbersIn("خفض التكاليف ٣٠٪")` returns nothing, and an invented metric written in those digits passes the fact-check.
The vault already accepts Arabic text, and the AI can write Arabic. Close the gap.

## Prior art to check first
None found. This is Nexus's own fact-check.

## What to build
1. Add a `toAsciiDigits(text)` helper in `src/lib/provenance.ts` that maps:
   - U+0660–0669 and U+06F0–06F9 to 0–9;
   - the Arabic decimal separator U+066B to `.`;
   - the Arabic thousands separator U+066C to `,`;
   - the Arabic percent sign U+066A to `%`.
2. Apply it inside `numbersIn`, and inside `normalizeText` (the function `verified_metrics` matching goes through), so
   the same number in either script compares equal: "٣٠٪" in a bullet matches "30%" in the vault, and the reverse.
3. Check that every other number check in the file (`validateBulletProvenance`, `auditFreeText`, `evidenceNumbers`)
   goes through `numbersIn` or `normalizeText`. Fix any check that doesn't.

## Database
None.

## Tests
Add these cases to the existing provenance tests (find them with `grep -l numbersIn src/test`):
- `numbersIn` reads `٣٠٪`, `١٬٢٠٠`, `٣٫٥` and Persian `۴۲` as `30`, `1200`, `3.5` and `42`.
- A bullet with an Arabic-digit number missing from the vault is rejected.
- The same number in Arabic digits, backed by the vault in ASCII digits, passes, and so does the reverse.
- The free-text audit rejects an unsupported Arabic-digit number in a cover letter.

## Acceptance checks
- [ ] `bun run check` passes.
- [ ] An invented metric in Arabic-Indic or Persian digits can no longer pass `validateBulletProvenance` or
  `auditFreeText`.
- [ ] The row in `docs/agents/STATUS.md` links the PR.

## Out of scope
Number words in Arabic (such as "ثلاثون"). Mention them in the PR as a follow-up if they turn out to matter. Arabic CV
export (10.6).

## Owner questions
None.
