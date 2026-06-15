# ai-starter

A **stack-agnostic starter for building apps with Claude Code.** It ships no application
code — instead it ships a battle-tested *way of working with AI*: a four-agent feature
pipeline plus three living documents (spec, guidance, test plan). You pick the stack when
you start a project; the AI layer stays the same.

> Extracted and generalized from a real React Native + Expo project. The value here is the
> **methodology**, not a framework — which is exactly why it's reusable across very
> different projects.

## What's inside

```
.claude/agents/         The feature pipeline (read each for its exact contract):
  planner.md            → read-only: turns a request into a concrete plan
  tester.md             → TDD red: writes failing logic-only tests
  coder.md              → implements until tests are green
  reviewer.md           → read-only gate: APPROVED / CHANGES REQUIRED
.claude/commands/
  feature.md            → /feature — the orchestrator: runs the pipeline with the gate loop
.claude/settings.local.json   Minimal permission allowlist (npm / tsc / git / Playwright)
.mcp.json               Playwright MCP — for browser-driven smoke tests
CLAUDE.md               Project guidance + the Stack/Commands the agents read. Has slots.
SPEC.md                 Living spec (SDD). Numbered structure incl. Out-of-scope + Limits.
TESTING.md              Layered verification + manual test plan template.
.gitignore
```

Three ideas do the heavy lifting:

1. **The orchestrated pipeline** — an orchestrator (the main session, via `/feature`)
   executes the plan step by step and delegates: planner → tester → coder → reviewer, with
   a gate loop (failing tests → coder; reviewer *incomplete* → coder). Small, ordered,
   each with one job; plans and reviews are read-only.
2. **The single data-access layer** — all data goes through one layer, declared in
   `CLAUDE.md`. This is what keeps the backend swappable (local-first ↔ hosted).
3. **Spec-driven, with an explicit Out-of-scope** — `SPEC.md` §7 lists what the product
   deliberately does *not* do, so the AI doesn't add features speculatively.

The agents are **stack-agnostic on purpose**: they defer every concrete detail (the test
command, where the data layer lives, the UI conventions) to the project's own `CLAUDE.md`.
Fill that in once, and the agents become as sharp as if they were hand-written for your
stack.

## Bootstrap a new project

### 0. Clone without history
```bash
npx degit <your-user>/ai-starter my-app    # or: "Use this template" on GitHub
cd my-app
git init && git add -A && git commit -m "Start from ai-starter"
```

### 1. Choose a stack
Open Claude Code and talk through the idea first. Use the guide below to pick a stack
deliberately — this decision shapes everything after it.

| If the app is… | Pick | Why |
|---|---|---|
| **Web-first, with iOS/Android as the *same* app in the stores** | **Vite + React + TS, Tailwind + shadcn/ui, Capacitor** | One web codebase; Capacitor wraps it natively. Best for tools / SaaS / CRUD where native "feel" isn't the headline. WebView ≠ native perf for heavy/gesture-driven UI. |
| **Mobile-first, native apps are the product, web is a bonus** | **Expo / React Native (+ react-native-web)** | One RN codebase → iOS + Android natively, web for free. Native feel and APIs first-class. |
| **Web only, no app stores** | **Vite/Next + React + TS, Tailwind + shadcn/ui** | Skip the native wrapper entirely. |
| **Backend / accounts / sync needed** | add **Supabase** (or similar) *behind the data layer* | Keep the single data-access layer; default to local-first and swap the implementation when a project actually needs sync. |

Default lean for this starter's author: **web-first + Capacitor + Tailwind/shadcn +
Vitest, local-first by default**. Adjust per idea.

### 2. Fill the docs (in conversation with Claude)
- **`CLAUDE.md`** → fill the **Stack**, **Commands**, **Architecture**, and **Domain
  rules** slots. This is what makes the agents concrete.
- **`SPEC.md`** → write §1 goal, §2 stack, §5 the first feature(s), and — importantly —
  §7 **Out of scope**.
- **`TESTING.md`** → adapt the verification layers to the stack; you'll add cases as
  features land.

### 3. Scaffold the chosen stack
This starter ships no app code by design (it's already the first TODO in `SPEC.md` §8).
Scaffold the framework, the single data-access layer, the UI kit, and the test runner
to match `CLAUDE.md` → Stack. Verify `npm run dev` and the test command work, then commit.

### 4. Build features with the pipeline
For each non-trivial feature, run `/feature <description>`. The **orchestrator** (the main
session) executes a plan step by step and delegates to the agents with a gate loop:

> **planner** → **tester** → **coder** → *(Tests passing? no → coder)* → **reviewer** → *(incomplete → coder)* → next task

Plan first (read-only), write failing logic-only tests, implement until green, then gate
with the reviewer (it runs the test + type-check commands and checks against the plan,
the domain rules, and Out-of-scope). Verify UI/native behavior by running the app per
`TESTING.md`. You can also drive the same loop by hand instead of `/feature`.

## Conventions worth keeping

- **Logic-only unit tests.** Test pure logic (the data layer, utils). Don't write brittle
  UI/component tests — UI is verified by **browser smoke** (the reviewer drives the affected
  flow with the Playwright MCP), and native-only behavior by running the app per `TESTING.md`.
- **Don't scatter data access.** Everything goes through the one data layer.
- **Update the spec.** `SPEC.md` is alive — change it on every significant decision.
- **Respect Out-of-scope.** It's the cheapest way to keep an AI from over-building.
- **Models are routed by task.** The planner tags each step `[S]`/`[M]`/`[L]`; the
  orchestrator runs cheap work on haiku/sonnet and reserves opus for complex steps, the
  plan, and the review gate — with auto-escalation when a task proves hard (`CLAUDE.md` →
  *Model routing*).
