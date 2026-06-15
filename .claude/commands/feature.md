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
2. Execute the plan step by step. **For each task, delegate work in the following order:**
   1. **tester** — write failing logic-only tests for this task's pure logic. (Skip only
      if the planner marked the task as having no testable logic.)
   2. **coder** — implement until the tests are green.
   3. **Gate — Tests passing?**
      - **no** → go back to the **tester** (the tests or their expectations need revising),
        then the **coder** again. Repeat until green.
      - **yes** → continue to review.
   4. **reviewer** — read-only gate; runs the test + type-check commands and checks the
      task against the plan, the domain rules, and `SPEC.md` → Out of scope.
      - **incomplete** (CHANGES REQUIRED) → go back to the **coder** with the reviewer's
        specifics, then re-run the gate. Repeat.
      - **OK** (APPROVED) → this task is done; move to the **next task**.
3. When every task is APPROVED, stop and summarize what shipped, per file.

Keep each delegation tight. Don't write code in this thread — delegate it.
