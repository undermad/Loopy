---
name: writing-docs
description: Style rules for every page under docs/, README.md, CONTRIBUTING.md and any other prose in the Loopy repository. Use before writing or editing documentation.
---

# Writing documentation for Loopy

Documentation is read by developers who know the domain but not this repository. Every page must be understood in under two minutes.

## Rules

- Lead with what the reader does or needs to know. Context comes after, if at all.
- One idea per paragraph. Three sentences is a long paragraph.
- Short sentences, active voice, present tense.
- Use a table when facts are parallel (commands, options, levels). Use a list for steps.
- Name files, scripts and flags exactly as they appear in the repository, in backticks.
- Do not restate code that is visible in the repository. Explain why it exists and how to use it.
- No marketing language, no filler, no "simply", "just", "easily", "powerful".
- No emoji. No exclamation marks.
- Headings are nouns or noun phrases. One H1 per page, provided by the title.
- Every page starts with a one-line frontmatter `description`.

## Keeping docs current

A change to behaviour, tooling, scripts or conventions updates the matching page in `docs/docs` in the same commit. Decisions that are hard to reverse get a short ADR in `docs/docs/decisions` with Context, Decision and Consequences.

## Checks

`markdownlint-cli2`, `cspell` and Prettier run on every commit. New project words go in `cspell-words.txt`, sorted.
