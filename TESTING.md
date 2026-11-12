# `<PROJECT_NAME>` — Manual Test Plan

> Companion to [SPEC.md](SPEC.md). Covers everything that **cannot** be verified by the
> automated layers — the things a human (or a browser-driving agent) must exercise.
>
> Template: adapt the layers and areas to this project's stack. Delete this quote block
> once it has real cases.

---

## 1. Verification strategy (layers)

The project uses a layered strategy; this document is the top layer. Each test belongs to
exactly one layer — push every check as far down (cheaper, more automated) as it will go.

| Layer | Tool | What it covers |
|---|---|---|
| Unit tests | `<test command>` | Pure logic: the data-access layer, utils (parsing, validation, formatting, search) |
| Type check | `<typecheck command>` | Strict TypeScript across the codebase |
| Browser smoke | Playwright MCP on the dev server | The flow a feature just added or changed — once, at the feature gate |
| E2E regression | `<e2e command, or "not set up yet">` on `<target: web build / emulator>` | *Optional.* The P0 flows, re-run before a release, so an old flow can't break silently — see [docs/e2e.md](docs/e2e.md) |
| **Manual (this plan)** | `<device / native build>` | Native modules, OS dialogs, gestures, permissions, file system, share sheet, app lifecycle |

**The browser-smoke layer runs inside the pipeline:** the **reviewer** drives the affected
flow with the Playwright MCP as part of the feature gate (see `.claude/agents/reviewer.md`
check 7). A smoke proves the flow works on the day it ships and leaves nothing behind. The
optional **E2E** layer is what keeps it working: it is not part of the pipeline — you add it
and run it yourself — but once it exists, every P0 case in §5 that a browser or emulator can
reach should have an E2E test, and this document's **manual** layer covers only what neither
can reach.

**E2E state strategy:** `<how each test gets a known state — e.g. the web build runs on an
in-memory database that resets per page load; on the emulator data persists, so tests
create uniquely named records>`.

**Why a manual layer exists:** `<list the gaps the automated layers can't reach for this
stack — e.g. native APIs have no web implementation, OS permission dialogs, real device
persistence>`. Every case below exercises at least one of those gaps.

### Out of scope of this plan
- `<Test-only platforms (e.g. the web build if it's a test env, not a product surface).>`
- Features listed in `SPEC.md` → **Out of scope**.
- `<Performance/load testing, unless it's a real risk for this app.>`

## 2. Test environment

### Device / platform matrix
| # | Target | OS | Priority | Notes |
|---|---|---|---|---|
| E1 | `<primary platform>` | `<...>` | **P0 — primary** | `<why primary>` |
| E2 | `<secondary>` | `<...>` | P1 | `<...>` |

### Preconditions for every session
1. `<test command>` green, `<typecheck command>` clean and — once the layer exists —
   `<e2e command>` green on the commit under test.
2. App installed fresh **or** state reset (each case states which).
3. `<any locale/config preconditions>`.

### Standard test data
- `<Reusable fixtures referenced by the cases below, e.g. "Record A: …", "Record B with
  non-ASCII name: …">`

## 3. Conventions

- **ID scheme:** `<AREA>-<number>` — one short prefix per feature area.
- **Priority:** P0 = smoke (run on every build), P1 = full pass before release, P2 = edge.
- **Result recording:** Pass / Fail / Blocked + target from the matrix. A Fail needs:
  repro steps, expected vs. actual, screenshot/recording, platform + OS.
- Each case lists the `SPEC.md` section it traces to.
- **Automate downwards.** When a case here can be driven by a browser or an emulator, turn
  it into an E2E test and mark the case `(E2E: <test file>)` — a human then runs it only
  for the release pass. A bug that was found by hand and fixed gets the same treatment.

## 4. Test cases

> Group by feature area, mirroring `SPEC.md` §5. Template for one case:

### `<AREA>` — `<Feature>` (SPEC §`<x>`)

**`<AREA>-01` · P0 · `<short title>`**
Pre: `<state>`.
1. `<step>`
2. `<step>`
- Expected: `<observable result; no "—" placeholders; no crash>`.

## 5. Smoke suite (run on every build)

The P0 set, in execution order:
`<AREA-01 → AREA-02 → …>`

`<~N minutes on one <primary platform>. The full P0+P1 set is the release gate.>`

## 6. Exit criteria

- 100% of P0 passed on the primary platform (the E2E suite green counts for the cases it
  automates).
- No open defects in `<data-loss / critical class>`.
- P1 failures triaged: fixed, or explicitly accepted and recorded in `SPEC.md` §9.
