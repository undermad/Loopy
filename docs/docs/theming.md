---
sidebar_position: 8
description: Light and dark mode, custom themes as files, and how colours reach the screen.
---

# Theming

## Modes and themes

`settings.theme` holds a mode and two theme ids: `{ mode: 'system' | 'light' | 'dark', light, dark }`. The mode picks the scheme, following the OS when it is `system`, and the scheme picks which of the two themes applies. Built-in `light` and `dark` are always present; custom themes add to the list.

## Theme files

A theme is a JSON document validated by `themeSchema` in `src/shared/theme.ts`: an id, a name, a `base` of light or dark, and fourteen hex colours. Custom themes live in `userData/themes/<id>.json`, handled by `createThemesStore`. Built-ins are code, not files, and cannot be saved over or deleted.

Export writes the theme inside the exchange envelope from `src/shared/exchange.ts`, with a `.loopy-theme.json` name. Import validates the envelope and the theme, gives it a new id if one already exists, and copies it into the themes directory.

## How colours reach the screen

`tokens.scss` holds the light colours on `:root` and the dark ones on `[data-theme='dark']` for the first paint. After boot, `applyTheme` in `src/renderer/lib/theme` writes each colour as a custom property on `<html>`, sets `data-theme` to the base and sets `color-scheme`. Hover, pressed and other shades derive with `color-mix()`, so a theme only names base colours.

The `ThemeProvider` component re-applies the active theme whenever settings, the theme list or the system scheme change, and applies `uiFont` and `fontSize` the same way.

| Channel                          | Does                                        |
| -------------------------------- | ------------------------------------------- |
| `shell:getNativeTheme`           | Current OS scheme                           |
| `shell:nativeThemeChanged`       | Pushed from main when the OS scheme changes |
| `themes:list`                    | Built-ins first, then custom themes         |
| `themes:save`, `themes:delete`   | Custom themes only                          |
| `themes:export`, `themes:import` | File dialogs in main, envelope on disk      |
