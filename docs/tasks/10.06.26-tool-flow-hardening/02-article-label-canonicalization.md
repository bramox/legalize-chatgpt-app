# Phase 02: Article Label Canonicalization

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Make `get_article` accept natural Spanish article labels and suffix variants while preserving exact source-grounded article numbers in responses.

## Scope

- Canonical article-number normalization.
- Parser and database lookup alignment.
- Compatibility lookup for legacy malformed stored article numbers.
- Regression tests for Spanish suffixes.

## Checklist

> Mark completed items as `[x]`.

- [x] Add one shared canonicalization helper for article labels used by parser-facing tests and lookup-facing tests.
- [x] Normalize labels by trimming, collapsing whitespace, stripping `Artículo` / `Articulo` / `art.` prefixes, preserving suffixes, and converting `38ter` to `38 ter`.
- [x] Support common Spanish suffixes including `bis`, `ter`, `quater`, `quinquies`, `sexies`, `septies`, `octies`, `nonies`, and `decies`.
- [x] Update `getArticle` lookup to try exact article number first, then canonicalized variants.
- [x] Add compatibility fallback for legacy stored values such as `38 ` when the canonical request is `38 ter`, but return the canonical article number when the canonical source can be recovered.
- [x] Ensure `unknown_article.suggestions` use canonical article numbers and never return malformed values such as `38 `.
- [x] Remove stale test comments that say implemented behavior will fail.
- [x] Commit: `git commit -m "Canonicalize Spanish article labels"`

## Validation

- [x] `get_article` succeeds for `38 ter`, `Artículo 38 ter`, `artículo 38 ter`, and `38ter`.
- [x] Suggestions never expose malformed article numbers for known suffix articles.
- [x] Existing Article `1`, `1 bis`, `único`, and regional fixture tests still pass.
- [x] `pnpm build` and focused parser/store/handler tests pass.

## Dependencies / Risks

- Do not over-normalize article labels in a way that merges distinct official article numbers.
- Compatibility fallback should be temporary and safe; it must not fabricate cross-law article matches.
