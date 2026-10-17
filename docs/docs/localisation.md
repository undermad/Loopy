---
sidebar_position: 9
description: Translation resources, the i18next setup and how to add a language.
---

# Localisation

Resources live in `src/shared/locales/<language>/<namespace>.json`, one file per namespace: `common`, `settings`, `shell`, `welcome` and `editors`. `src/shared/i18n.ts` bundles them, lists supported languages and resolves the `system` setting against the OS locale. Keys are typed: `src/renderer/lib/i18n/i18next.d.ts` tells i18next the shape of the English bundle, so a misspelt key fails `npm run typecheck`.

Components call `useTranslation('<namespace>')` from `@renderer/lib/i18n` and never hold English literals. Dates and relative times go through `useFormat`, which wraps `Intl` with the active language.

`settings.language` is `system` or a language code. The renderer applies a change at once through `applyLanguage`; no restart is needed.

## Adding a language

1. Copy `src/shared/locales/en` to the new code and translate every value.
2. Add the code to `SUPPORTED_LANGUAGES` and the `resources` map in `src/shared/i18n.ts`, and to `languageSettingSchema` in `src/shared/app-settings.ts`.
3. Add its label under `language` in each `settings.json`.

`tests/unit/shared/i18n.test.ts` fails when a language lacks a namespace or a key that English has.
