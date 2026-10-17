---
sidebar_position: 6
description: Tokens, layers, SCSS Modules and how to add a themed component.
---

# Styling

## Tokens

Design tokens are CSS custom properties in `src/renderer/styles/tokens.scss`. Light values sit on `:root`, dark values on `[data-theme='dark']`. Colours, spacing, radii, typography and shadows all come from tokens. Custom properties, not SCSS variables, so themes can switch at runtime.

Semantic colours cover background, two surfaces, text, border, accent, focus, danger, warning, success and selection. Hover and pressed shades derive with `color-mix()` and are never stored. At runtime the theme library writes the active theme over these properties, see the theming page.

Toggle dark mode in DevTools with `document.documentElement.dataset.theme = 'dark'`.

## Cascade layers

`src/renderer/styles/global.scss` declares the order once:

```scss
@layer reset, tokens, base, components, overrides;
```

Later layers win regardless of specificity. Component styles sit in `components`; one-off adjustments go in `overrides`.

## SCSS Modules

Every component has `Name.module.scss` next to `Name.tsx` and imports it as `styles`. Class names are local to the file, so a large codebase never fights naming collisions. Access classes as `styles['name']`; the project enables `noPropertyAccessFromIndexSignature`.

Shared mixins live in `src/renderer/styles/mixins.scss` and are pulled in with `@use '../../styles/mixins' as *;`.

## Adding a themed component

1. Create `src/renderer/components/Name/Name.tsx` and `Name.module.scss`.
2. Use tokens for every colour, size and radius. No literal values in component files.
3. Add a focus style with the `focus-ring` mixin on anything interactive.
4. Add a component test under `tests/unit/renderer`.
5. Run `npm run lint`; Stylelint enforces property order and SCSS conventions.

## Primitives, icons and fonts

Interactive widgets come from the component library under `src/renderer/ui`, built on Radix Primitives and styled with SCSS Modules. See the components page. Icons come from `lucide-react` and inherit `currentColor`. Inter is bundled through `@fontsource/inter` because the app is offline.

## Modern CSS

Electron ships one Chromium, so there is no browserslist and no autoprefixer. Native nesting, container queries, `:has()`, `color-mix()`, `@property`, subgrid and view transitions are safe to use. SCSS is kept for mixins and partials.
