# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. Do not open a public issue for security problems.

Include what you found, how to reproduce it and which version or commit you tested. You will get an acknowledgement within five working days.

## Supported versions

Loopy has no released versions yet. Fixes land on `main`.

## What the repository checks

- `secretlint` on every commit and `gitleaks` over the full history in CI.
- `npm audit` at high severity and CodeQL on every pull request and weekly.
- The renderer runs with context isolation and the sandbox on, without Node integration, behind a Content Security Policy. A unit test enforces these settings.
