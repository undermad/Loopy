---
description: SCSS Modules with tokens and cascade layers.
---

# 0009 SCSS Modules with tokens and cascade layers

## Context

A large desktop UI needs scoped styles, runtime theming and a way to keep specificity under control. The team prefers CSS and SCSS over utility classes or CSS-in-JS.

## Decision

SCSS Modules per component, design tokens as CSS custom properties on `:root` and `[data-theme='dark']`, and a single cascade layer order declared in `global.scss`. Stylelint enforces conventions.

## Consequences

No Tailwind, no styled-components. No autoprefixer or browserslist because Electron ships one Chromium. Modern CSS is used directly; SCSS is kept for mixins and partials.
