---
description: A per-user, unsigned NSIS installer for Windows built by electron-builder.
---

# 0021 Per-user NSIS installer for Windows

## Context

Loopy ran only from a checkout with `npm run dev`. It needs to install like any desktop app: shortcuts, an uninstaller and `.loopy` files that open in it. electron-builder was already a dependency. The only target machine today is the author's Windows PC, and there is no code signing certificate.

## Decision

`npm run dist:win` builds an NSIS installer. It installs per user, so no administrator prompt, lets the user pick the folder and adds Start menu and desktop shortcuts. Uninstalling keeps the user data directory. The installer is not signed. Unpacked builds store data in `loopy-dev` so a dev run never migrates the installed app's projects. A `.loopy` file opened from Explorer goes through the same import as File, Import, and a second launch hands its file to the running window.

## Consequences

SmartScreen warns on first run until the installer is signed. A certificate, auto-update and macOS and Linux installers are separate work. The installer carries every production dependency even though Vite already bundles the renderer, so it is larger than it needs to be. CI builds the installer on every pull request, which adds a Windows job but proves packaging still works.
