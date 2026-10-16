---
description: Playwright with the Electron driver for E2E.
---

# 0006 Playwright with the Electron driver for E2E

## Context

End-to-end tests must launch the real app, not a web page, and assert on the renderer the way a user would.

## Decision

Playwright's built-in Electron driver against the built app in `out/`. One shared fixture launches and closes the app per test.

## Consequences

Tests are slower than unit tests and run one at a time, so the suite stays small. axe-core is injected with `evaluate` because the Content Security Policy blocks script tags.
