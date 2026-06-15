# First real run — pipeline verification

A scripted first run of the ai-starter pipeline on a concrete tiny app. It is designed to
**verify three things in practice**:

1. **Weight** — the cycle runs *once per feature* (not per step) and feels proportional.
2. **Reviewer → Playwright** — the reviewer (a subagent) actually drives the browser-smoke
   via the `mcp__playwright__browser_*` tools.
3. **Model override** — the orchestrator spawns agents on the model routed from the
   feature's complexity rating (planner/reviewer = opus, tester/coder = the routed model).

> **How to use:** make a working copy of this repo so you don't dirty the template, open
> Claude Code *inside it*, then paste the **Prompt to paste** block below.
> ```bash
> npx degit . ../split-test   # or copy the dir
> cd ../split-test && claude
> ```
> Delete this file in real projects — it's only a test harness.

---

## Prompt to paste

You are in a fresh project bootstrapped from **ai-starter**. Do a real end-to-end run of the
feature pipeline and **explicitly verify three targets**: (1) the cycle runs once per
feature and feels proportional, (2) the reviewer really drives the Playwright MCP
browser-smoke, (3) the orchestrator spawns agents on the routed model. **Be verbose about
these three**: announce the feature's complexity rating, the model you spawn each agent on,
and narrate the reviewer's Playwright smoke.

### App idea (concrete, tiny, local-first, web)
**"Split"** — a no-account bill-split calculator. v1 is one feature: enter a bill total and a
number of people, see each person's exact share, with the rounding remainder distributed
cent-by-cent so the shares always sum back to the total (no lost or invented cents).

### Phase 1 — Bootstrap (do this directly, NOT via /feature)
Use a deliberately minimal stack so the run is fast (skip Capacitor and shadcn for this test):
- Vite + React 18 + TypeScript (strict), Tailwind CSS, Vitest (logic-only)
- Local-first, no backend, no DB — UI state in the component, **pure logic in `src/utils/`**
- Path alias `@/* → src/*`

Steps:
1. Scaffold Vite React-TS; add Tailwind and Vitest; wire the `@` alias in `vite.config.ts`
   and `tsconfig.json`.
2. Fill `CLAUDE.md` → **Stack**, **Commands** (`npm run dev`, `npm test`, `npx tsc --noEmit`,
   `npm run build`), **Architecture** (the single logic layer is `src/utils/`; UI in `src/`),
   and one **Domain rule**: *per-person shares must sum exactly to the total — distribute the
   remainder cent-by-cent.*
3. Fill `SPEC.md` §1 goal, §2 stack, §5.1 the split feature, §7 Out-of-scope (no accounts,
   one currency only, no tax/tip in v1).
4. Fill `.claude/hooks/verify.sh`: `TYPECHECK="npx tsc --noEmit"` and `TEST="npm test"`
   (this also tests the Stop-hook guardrail).
5. Verify `npm run dev` serves and `npm test` runs (fine with zero tests). Commit.

### Phase 2 — Run the pipeline
Keep the dev server running (you own it, so the reviewer can drive it), then run:

```
/feature Bill split: the user enters a total amount and a number of people (>= 1) and sees each person's share. Distribute the rounding remainder cent-by-cent so the shares sum exactly to the total. Invalid input (empty, 0 people, negative) shows no shares and never NaN.
```

What to expect (note any deviation):
- Planner rates this **[M]** → tester + coder spawned on **sonnet**; planner + reviewer on **opus**.
- Tester is **not** skipped — there is real pure logic. Expected tests for `src/utils/split.ts`:
  `splitBill(1000, 3)` → `[334, 333, 333]` cents; the shares sum to the total; `(x, 1)` → `[x]`;
  invalid input → `[]`.
- Coder implements `src/utils/split.ts` plus a small form + result list in `src/`.
- Reviewer runs **once**: `npm test` + `npx tsc --noEmit` + a **Playwright smoke** (navigate to
  the dev server, fill total + people, confirm the shares render, console clean) + a screenshot.

### Phase 3 — Verdict on the three targets
After APPROVED, write a short report:
1. **Weight** — total agent invocations? Proportional for a one-feature change? Anything redundant?
2. **Playwright** — did the reviewer subagent successfully call `mcp__playwright__browser_*`?
   If it could **not**, say so plainly — that triggers Plan B: move the browser-smoke up to the
   orchestrator (main session) and drop the browser tools from the reviewer.
3. **Model override** — did each agent run on the intended model? If the override didn't take
   and everything ran on one model, say so — Plan B is per-tier agent variants
   (`coder-light`/`coder-heavy`), see `CLAUDE.md` → *Model routing*.

If any target fails, **stop and report exactly what happened** instead of working around it.
</content>
