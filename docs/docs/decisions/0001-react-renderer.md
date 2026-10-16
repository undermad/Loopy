---
description: React for the renderer.
---

# 0001 React for the renderer

## Context

Loopy needs rich editors, drag and drop and diagram views. The renderer framework decides which component and editor libraries are available.

## Decision

React 19 with TypeScript. Vue and Svelte were considered; React has the widest choice of headless primitives and editor libraries for this kind of tool.

## Consequences

Testing Library and jsdom for component tests. Hooks rules enforced by ESLint. Docusaurus shares the React dependency, which keeps the toolchain uniform.
