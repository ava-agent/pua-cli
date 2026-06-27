# PUA CLI Triage - 2026-06-27

## Repository

- GitHub: `ava-agent/pua-cli`
- Public URL: `https://pua.rxcloud.group`
- Category: TypeScript CLI plus static web demo

## Actions Taken

- Fast-forwarded the local `main` branch to the remote Ark migration (`ad481a8`) and reapplied the local maintenance changes on top.
- Added `AGENTS.md` with CLI/web split, commands, environment, and packaging rules.
- Added ESLint 9 flat config, kept Ark provider defaults in the config wizard, updated prompt/config test assertions, and added `typescript-eslint`.

## Validation

- Passed with Vite CJS deprecation warning: `npm test`
- Passed with 56 existing warnings: `npm run lint`
- Passed: `npm run type-check`
- Passed: `npm run build`
- Passed: `cd web && npx tsc --noEmit`
- Passed: `scan_project.sh .`
- Passed: real Ark `ArkLLM.chat` smoke returned content.

## Deployment

No redeploy was needed for this local maintenance sync. The Ark runtime migration, Vercel env update, production deploy, and browser verification are recorded in the workspace migration checklist under the earlier `pua-cli` entry.
