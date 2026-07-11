# Repository Guidelines

## Project Shape

This repository ships the `workplace-pua-cli` TypeScript CLI plus a static web demo under `web/`. CLI source is in `src/`, executable wrappers are in `bin/`, and screenshots/docs are part of the public package story.

## Commands

- `npm run dev` runs the CLI from TypeScript.
- `npm run build` compiles to `dist/`.
- `npm test` runs Vitest.
- `npm run lint` runs ESLint on `src/`.
- `npm run type-check` runs TypeScript no-emit checks.

## Environment

Use `.env.example` for CLI provider credentials and `web/.env.example` for the hosted demo. The default provider is Volcengine Ark Agent Plan via `ARK_API_KEY`, `ARK_BASE_URL`, and `ARK_CHAT_MODEL`. Do not commit AI provider API keys.

## Editing Rules

- Keep CLI behavior and web demo copy aligned when adding modes or roles.
- Preserve `bin/pua` compatibility for npm global installs.
