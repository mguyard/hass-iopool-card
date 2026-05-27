# Skills Catalog

This file is a navigation index for humans and agents.

Use it to quickly identify the narrowest relevant skill for a task before loading the full `SKILL.md`.
The source of truth remains each skill's own `SKILL.md` file and its `description` frontmatter.

## How to use this index

1. Start here when the task domain is clear but the best skill is not.
2. Prefer the narrowest matching skill over a broad fallback.
3. Combine multiple skills when the task spans domains.
4. For implementation and review, pair domain skills with baseline quality and verification skills when relevant.

## Quick routing hints

- **TypeScript / Lit / Lovelace card / entity resolution / components** → `typescript-lovelace-card`
- **Commit messages, PR title/description, pre-commit test gate, branch rules** → `git-conventions`
- **Running tests / Vitest / devcontainer detection for this project** → `testing-iopool-card`
- **Documentation pages in `docs/` (MDX, docs.json, components)** → `docs-iopool-card`
- **Generic testing principles (behavior, determinism, unit vs E2E)** → `testing-qa`
- **Planning / decomposition / readiness gates** → `planning-structure`
- **Read-only discovery / routing prep** → `research-discovery`
- **General code quality** → `code-quality`
- **Security review baseline** → `security-best-practices`
- **Shared review contract** → `review-core`
- **Independent review routing / review gates** → `review-orchestration`
- **Multi-model review orchestration** → `multi-model-review`
- **Parallel isolated work using git worktrees** → `git-worktree`
- **Memory boundaries and durable repo memory** → `memory-management`

## Domain skill — hass-iopool-card

| Skill | Use for | Common triggers |
| --- | --- | --- |
| `typescript-lovelace-card` | All implementation in `src/` — LitElement card, editor, helpers, components, entity resolution, localization, debug mode, release | LitElement, Lit, component, entity, device, hass, setConfig, lovelace, gauge, chart, pump, filtration, boost, i18n, TypeScript, Rollup |
| `git-conventions` | Commit messages, PR title/description, pre-commit test gate, branch rules | commit, PR, gitmoji, scope, test gate, branch, dev, conventional commits |
| `testing-iopool-card` | Project-specific test setup: directory structure, tiers, Vitest commands, devcontainer detection, mock hass | vitest, devcontainer, jsdom, @open-wc/testing, fixtures, test tiers, run tests |
| `docs-iopool-card` | Documentation pages in `docs/` — MDX format, frontmatter, components, docs.json registration, screenshot placeholders | docs, MDX, frontmatter, docs.json, screenshots, introduction, configuration, modes, troubleshooting |

## Workflow and orchestration skills

| Skill | Use for | Common triggers |
| --- | --- | --- |
| `planning-structure` | Planning tracks, epics, readiness gates, plan delta handling | planning, decomposition, readiness, feature slices, epics |
| `research-discovery` | Fast broad-to-narrow read-only discovery before planning or routing | discover, scout, map codebase, entry points, reuse search |
| `memory-management` | Durable vs session memory rules and memory sync workflow | memory update, durable knowledge, `.agent-memory`, session notes |
| `git-worktree` | Isolated parallel work for risky refactors or overlapping file ownership | worktree, parallel branch, isolation, risky refactor |
| `review-orchestration` | Review routing, independent review gates, and optimization follow-up | review gate, post-implementation review, multi-review, cleanup pass |
