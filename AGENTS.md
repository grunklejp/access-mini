# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Type-safe ABAC core (policy model, evaluator, helpers). Public entry is `src/index.ts`.
- `tests/`: Mirrors `src/` (e.g., `src/policy/` -> `tests/policy/`). Keep fixtures in `tests/fixtures/`.
- `examples/`: Small runnable demos using Bun.
- `dist/`: Build output (ESM + `.d.ts`). Not checked in.
- `docs/` and `api-spec.md`: Design and API notes; keep in sync with code.

## Build, Test, and Development Commands
- `bun install`: Install dev dependencies (0 runtime deps — keep `dependencies` empty).
- `bun test --coverage`: Run unit/integration tests with 100% coverage thresholds.
- `bunx tsc -p tsconfig.build.json`: Type-check and emit `.d.ts` to `dist/`.
- `bun build ./src/index.ts --outdir dist --target bun,esnext --minify`: Produce ESM bundle (no external runtime deps).
- `bunx eslint .` / `bunx prettier --check .` and `--write` to fix.

## Coding Style & Naming Conventions
- TypeScript: `strict` on, no implicit `any`, 2-space indent, semicolons, single quotes.
- Names: types/interfaces/enums `PascalCase`; functions/vars `camelCase`; constants `UPPER_SNAKE_CASE`.
- Files: kebab-case (`policy-engine.ts`). Public APIs live behind `src/index.ts` and are exported deliberately.

## Testing Guidelines
- Framework: Bun’s built-in test runner (`bun:test`).
- File names: `*.spec.ts` (unit) and `*.int.spec.ts` (integration).
- Coverage: Enforce 100% globally; add tests with each PR. Mirror structure of the code under test.
- Example: `bun test --coverage --bail` for fast feedback.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat(policy): add attribute evaluator`). Keep focused and reference issues.
- PRs: Include description, rationale, coverage results, and API changes. Add or update examples and `api-spec.md` when behavior changes.
- Breaking changes: Use `BREAKING CHANGE:` footer and bump major; document migration notes.

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` for local-only variables; provide `.env.example` when needed.
- Reproducibility: Commit `bun.lockb`. Keep `dependencies` empty; only use `devDependencies`.
- Validate all external inputs at boundaries; add negative tests for policy parsing/evaluation.
