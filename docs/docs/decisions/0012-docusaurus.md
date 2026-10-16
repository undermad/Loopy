---
description: Docusaurus for documentation.
---

# 0012 Docusaurus for documentation

## Context

Documentation must live in the repository, be updated with every change and be easy to browse and search.

## Decision

Docusaurus 3 in `docs/` as its own npm package, docs-only mode, offline local search, deployed to GitHub Pages from `main`.

## Consequences

`docs/` has its own `node_modules`. Pages are linted with markdownlint-cli2 and cspell. VitePress was the lighter alternative and was not chosen.
