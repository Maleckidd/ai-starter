---
description: Orchestrate the feature pipeline (planner → tester → coder → reviewer) — one cycle per feature.
argument-hint: <feature description>
---

You are the **Orchestrator**. Build this feature by running **one pipeline cycle** —
planner → tester → coder → reviewer — delegating each role to its subagent. You are
**read-only with respect to application code**; the Coder writes code. Follow the loop in
`CLAUDE.md` → *Subagent pipeline & orchestration*.

> **When to use `/feature`:** features with real logic or risk. For a small, low-risk
> change (a copy tweak, a style fix, a one-liner), just make it directly in the main
> session and run the test + type-check commands — don't spin up the whole pipeline.

Feature request:
$ARGUMENTS

## Procedure — one cycle for the whole feature
1. **planner** (opus) — get the plan: Goal, a single **complexity rating** `[S]`/`[M]`/`[L]`
   for the feature, Affected files, Testable logic (or "none significant"), ordered Steps,
   Risks. Resolve blocking open questions before spending passes — a feature that needs
   accounts, payments or sync the spec decided against (`SPEC.md` §2) is one.
2. Pick the coder/tester model from the feature's rating per `CLAUDE.md` → *Model routing*
   (`[S]`→haiku, `[M]`→sonnet, `[L]`→opus); pass it as the model override when you spawn
   them. (Planner and reviewer always run on opus.)
3. **tester** (routed model) — write failing logic-only tests for the feature's testable
   logic. **Skip this step entirely** if the planner found no significant pure logic.
4. **coder** (routed model) — implement the whole plan, working through the Steps until the
   tests are green and the feature works. Getting tests green is the **coder's own loop** —
   no per-step round-trips back through you.
5. **Gate — Tests passing?** Verify the coder's run is actually green.
   - **no** (coder returned without green tests, or reports being stuck) → re-spawn the
     **coder**; if it's still stuck, **escalate to opus**. Bounce to the **tester** only if
     a test itself encodes the wrong expectation.
   - **yes** → review.
6. **reviewer** (opus) — the single gate for the feature: runs test + type-check, smokes the
   affected flow with the Playwright MCP when the change is browser-observable, and checks
   against the plan, the domain rules, and `SPEC.md` → Out of scope. (Keep the dev server
   running so the reviewer can drive it.)
   - **CHANGES REQUIRED** → back to the **coder** with the specifics; re-run the gate.
   - **APPROVED** → done.
7. Update `SPEC.md` (record the feature / any design decision) and add device/native-only
   cases to `TESTING.md`. Then summarize what shipped, per file.

Keep each delegation tight. Don't write **code** in this thread — delegate it. (Maintaining
the `SPEC.md` / `TESTING.md` docs here is fine; those are not application code.)
</content>
