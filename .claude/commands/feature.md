---
description: Orchestrate the full feature pipeline (planner → tester → coder → reviewer) with the gate loop.
argument-hint: <feature description>
---

You are the **Orchestrator**. Build this feature by executing a plan **step by step** and
delegating each task to the project's subagents. You are **read-only with respect to
code** — you never edit code yourself; the Coder does. Follow the loop in
`CLAUDE.md` → *Subagent pipeline & orchestration* exactly.

Feature request:
$ARGUMENTS

## Procedure
1. Delegate to the **planner** (read-only). Get the plan: Goal, Affected files, Testable
   logic, ordered Steps, Risks. Surface blocking open questions before spending passes.
2. Execute the plan step by step. **For each task, delegate work in the following order.**
   First read the step's complexity tag from the planner and pick the model per
   `CLAUDE.md` → *Model routing* (`[S]`→haiku, `[M]`→sonnet, `[L]`→opus). Pass that as the
   **model override** when you spawn the tester and the coder for this step. (The reviewer
   always runs on opus; the planner already ran on opus.)
   1. **tester** — write failing logic-only tests for this task's pure logic, on the step's
      routed model. (Skip only if the planner marked the task as having no testable logic.)
   2. **coder** — implement until the tests are green, on the step's routed model.
   3. **Gate — Tests passing?**
      - **no** → back to the **coder** — keep implementing until the tests are green (this
        is the coder's loop). Only bounce to the **tester** if a test itself encodes the
        wrong expectation. **Escalation:** if this step's gate fails twice, re-spawn the
        coder on **opus** regardless of the tag, then continue.
      - **yes** → continue to review.
   4. **reviewer** — read-only gate; runs the test + type-check commands, smokes the
      affected flow with the Playwright MCP when the change is browser-observable, and
      checks the task against the plan, the domain rules, and `SPEC.md` → Out of scope.
      (Keep the dev server running so the reviewer can drive it.)
      - **incomplete** (CHANGES REQUIRED) → go back to the **coder** with the reviewer's
        specifics, then re-run the gate. Repeat.
      - **OK** (APPROVED) → this task is done. If it changed product behavior or settled a
        design decision, update `SPEC.md` (mark the feature / record the decision) and add
        any device/native-only cases to `TESTING.md`. Then move to the **next task**.
3. When every task is APPROVED, stop and summarize what shipped, per file, and confirm that
   `SPEC.md` and `TESTING.md` reflect the change.

Keep each delegation tight. Don't write **code** in this thread — delegate it. (Maintaining
the `SPEC.md` / `TESTING.md` docs here is fine; those are not application code.)
