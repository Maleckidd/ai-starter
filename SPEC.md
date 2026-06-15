# `<PROJECT_NAME>` — Technical Specification (SDD)

> Living spec-driven-development document. Consult it **before** implementing a feature;
> update it **after** any significant design decision. This is the source of truth the
> agents (planner, coder, reviewer) read.
>
> This is a template — replace the `<...>` placeholders. The numbered structure is
> deliberate; keep it. Delete this quote block once the spec has real content.

**Status:** `<draft | in development | stable>` · **Last updated:** `<YYYY-MM-DD>`

---

## 1. Product goal

`<One short paragraph: the problem, the user, and the single thing this app must do well.
What is the "escape hatch" / core promise (e.g. data is always exportable)?>`

## 2. Platform and stack

### Target platforms
`<e.g. Web (primary) + iOS & Android via Capacitor. Note any platform that is test-only,
not a product surface.>`

### Tech stack
`<List the concrete stack — mirror CLAUDE.md → Stack, with versions where they matter and
a one-line reason for each non-obvious choice.>`

## 3. Project architecture

### Directory structure
```
<tree of the top-level dirs and what each holds>
```

### Data flow
`<How state moves: who loads data, who mutates it, the single data-access layer, and why
there is/isn't a global store.>`

## 4. Data model

### Entities / tables
`<Each entity: fields, types, required vs optional, relations. Note how dates/ids are
stored.>`

### Key behaviors
`<Invariants: sort order, cascade/null-on-delete rules, what touches "updated_at", etc.>`

### Migrations
`<How schema changes are applied.>`

## 5. Features

> One numbered subsection per feature (5.1, 5.2, …). Each: what the user sees, the rules,
> edge cases, and which pieces are pure logic (testable) vs. require running the app.

### 5.1 `<First feature>`
`<Description, rules, edge cases.>`

### 5.2 `<Second feature>`
`<...>`

## 6. Design system

`<Color palette / tokens, typography, spacing, dark mode, base UI components and
interaction patterns. Never hardcode style values when a token exists.>`

## 7. Out of scope (deliberate decisions)

> The most important section for working with AI. List what this product intentionally
> does **not** do, so features aren't added speculatively. The agents treat this as a
> hard boundary.

- `<e.g. No cloud sync / accounts.>`
- `<e.g. No <feature> — deferred / rejected because <reason>.>`

## 8. TODO — open items

### High priority
- [ ] **Scaffold the chosen stack** (this starter ships only the AI-workflow layer — set
  up the framework, data layer, UI kit, and test runner per CLAUDE.md → Stack).
- [ ] `<...>`

### Medium priority
- [ ] `<...>`

### Low priority
- [ ] `<...>`

## 9. Known limitations and risks

`<Honest list of current gaps, accepted trade-offs, and risks — the counterpart to §7.>`
