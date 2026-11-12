# E2E — the regression layer

The reviewer's browser smoke proves a feature works **once**, on the day it
ships. Nothing stops the next feature from breaking it. E2E tests are what's
left behind: a small, deterministic suite that walks the app's most important
flows before every release.

This is an **optional layer, outside the pipeline**. The starter ships no E2E
tool — that depends on your stack — and the `/feature` agents neither write nor
run E2E tests. What it gives you is a place for the layer (a slot in
`CLAUDE.md` → **Commands**, a row in `TESTING.md`) and this guide. The project
this template came from runs its own E2E suite as a pilot; wiring the layer
into the planner, coder and reviewer is deliberately left until that has
proven itself.

## Where it sits

| Layer | Runs | Catches |
|---|---|---|
| Unit tests | every turn (Stop hook) | wrong logic |
| Type check | every turn (Stop hook) | broken contracts |
| Browser smoke (reviewer, Playwright MCP) | once per feature | "the new flow doesn't work" |
| **E2E suite** *(optional)* | by you: before a release, after touching a covered flow | "an old flow stopped working" |
| Manual plan (`TESTING.md`) | before release | what only a device or a human can see |

Keep E2E out of the Stop hook: a suite that boots the app is too slow to run
after every turn, and a slow hook gets disabled.

## What gets an E2E test

Keep the suite small. A test earns its place when it is one of these:

- a **P0 flow** from `TESTING.md` → *Smoke suite* — the handful of paths that
  make the app worth opening (create → save → see it in the list);
- a **domain rule** that only shows up through the UI (the form refuses an
  empty title; invalid numbers are saved as "no value", never `NaN`);
- a **regression that already happened once** — a bug a user, a tester or a
  usability study found and you fixed. A test is what says the fix still holds
  on every commit.

Everything else stays in unit tests. If a check can be a unit test, it should be.

## Rules that keep the suite alive

Rules 1 and 2 come straight from the source project's pilot; the rest are
standard practice for keeping any E2E suite trustworthy.

1. **Every test starts from a known state.** The easiest way is a build whose
   data resets per launch (an in-memory database on the web target, a cleared
   app on a device). Where data persists between tests, a test creates its own
   uniquely named records and never depends on another test's leftovers.
2. **Select by role, visible text or test id — never by coordinates.** A tap
   by pixel has no idea what it hit: in an early smoke run, a tap meant for
   "Restore" landed on "Export". Give the few elements without a stable label
   (an icon button, a tab) a test id.
3. **Assert the result, not the click.** After "Save", assert that the record
   is in the list, with its data. A flow that ends on a tap proves nothing.
4. **Deterministic first.** A test with fixed steps needs no model and gives
   the same answer every run. Use agentic ("do X in natural language") steps
   only where the path is genuinely open-ended, and always follow them with a
   hard assertion.
5. **One worker per shared resource.** One dev server or one emulator means
   tests run serially; parallelism there buys flaky tests, not speed.
6. **A flaky test is a bug.** Fix it or delete it the day it flakes. A suite
   people re-run "until it passes" is worse than no suite.

## Picking a tool

| Your stack | Reasonable choice |
|---|---|
| Web only | [Playwright Test](https://playwright.dev) — the same engine the reviewer's MCP smoke already uses. |
| Web **and** a native build of the same app (Capacitor, Expo / React Native) | A runner with both a browser and a device engine, so one test file can cover both targets — e.g. [`e2e`](https://github.com/tester-army/e2e) (`@e2e-dev/web` + `@e2e-dev/mobile`). It was pre-1.0 when this was written: pin exact versions. |
| Native only | [Maestro](https://maestro.mobile.dev) — YAML flows that select by text / accessibility label / test id. |

Ask context7 for the current setup steps of whichever you pick — these tools
move fast, and a config copied from memory is the classic stale-API bug.

## Setting it up

1. Install the tool and write **one** test: the app opens and shows its first
   screen. That single test already catches a broken build.
2. Put the run command in `CLAUDE.md` → **Commands** (`<e2e>`), and the layer's
   details in `TESTING.md` §1 (the target, and how each test gets a known
   state).
3. Run it before every release, and after a change to a flow it covers. When a
   feature adds a P0 flow, ask for its E2E test explicitly — in the `/feature`
   description or as a follow-up — because the pipeline won't add one on its
   own.

If you later want the pipeline to carry it, the natural seams are: the planner
names the flow that needs coverage, the coder writes the test, and the reviewer
runs the suite at the gate. That is a change to the agents' contracts — make it
in your project once the suite is stable, not before.

### Shape of a test

Illustrative — the API below is `e2e`'s; the shape is the same in any runner.

```ts
import { expect, test } from 'e2e';

// The first thing a broken build gets wrong: the app must start and render.
test('opens on the home screen', { tags: ['smoke'] }, async ({ app, screen }) => {
  await app.open();
  await expect(screen.getByRole('heading', '<App name>')).toBeVisible();
  await expect(screen.getByRole('button', 'Add item')).toBeVisible();
});

// A domain rule seen through the UI: the title is the only required field.
test('an empty form is not saved', async ({ app, screen }) => {
  await app.open();
  await screen.getByRole('button', 'Add item').tap();
  await screen.getByRole('button', 'Save').tap();
  await expect(screen.getByRole('heading', 'New item')).toBeVisible(); // still on the form
  await expect(screen.getByText('Saved')).toBeHidden();
});
```

Shared steps (`createItem(screen, {...})`) go in a support file next to the
tests, so a redesign of one form is one edit, not twenty.
