# Phase 01: Reproduce And Corpus Coverage

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Create deterministic evidence for the reported failures and ensure the test corpus can represent the expected legal sources before search or handler behavior is changed.

## Scope

- Bug-report reproduction tests.
- Fixture or corpus smoke coverage for `Ley 20/2007`, Article 38 ter.
- Fixture or corpus smoke coverage for `Real Decreto Legislativo 8/2015`, Article 308, when present in the source corpus.
- A clear distinction between missing source coverage and broken search behavior.

## Checklist

> Mark completed items as `[x]`.

- [ ] Add a test fixture or targeted integration fixture for the law that contains Article 38 ter about the reduced contribution regime for new self-employed workers.
- [ ] Add a test fixture or targeted integration fixture for `Real Decreto Legislativo 8/2015` if it is needed to verify the mismatched lookup path.
- [ ] Add failing tests for both reported `search_laws` queries before changing search logic.
- [ ] Add a failing test for `get_article` with `identifier: "Real Decreto Legislativo 8/2015"` and `article_number: "38 ter"`.
- [ ] Verify whether the production sync corpus contains the expected source files and record the result in a test or documented validation artifact.
- [ ] Keep fixtures minimal while preserving enough frontmatter, citation data, article headings, article numbers, and text to exercise the bug.
- [ ] Commit: `git commit -m "Add legal research bug reproduction coverage"`

## Validation

- The new reproduction tests fail against the current implementation for the reported reason.
- The fixture database can retrieve the relevant stable identifiers directly when exact identifiers are used.
- The tests do not depend on live network access.
- The fixture data includes source identifiers and URLs required by the existing shared citation contract.

## Dependencies / Risks

- If the upstream corpus does not include the expected articles, this phase should produce a corpus coverage finding and stop search-specific claims until the source gap is resolved.
- Fixtures must not rewrite or paraphrase legal text beyond what is necessary for a minimal deterministic test.
