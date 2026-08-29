# End-to-End Test Suite Spec

## 0 Why we’re doing this

We need fast, exhaustive, “no-boilerplate” tests for the V4A `apply_patch` functionality.

---

## 1 High-level objectives

| #   | Objective                 | Non-negotiable Rule                                                           |
| --- | ------------------------- | ----------------------------------------------------------------------------- |
| 1   | **Spec completeness**     | Every MUST / SHOULD in the V4A spec (§6–§10) appears in at least one fixture. |
| 2   | **Single-file truth**     | Each fixture file embeds inputs _and_ expected outputs (or expected error).   |
| 3   | **Zero incremental code** | Engineers add a fixture → `bun test` passes → commit.                         |
| 4   | **Speed**                 | Suite < 250 ms (MemoryFS only, no disk).                                      |
| 5   | **Readability**           | Expected results clearly visible inside fixture.                              |

---

## 2 Directory layout

```
/tests
  fixtures/                   # the only place engineers touch
    add-001.yml
    add-002.yml
    del-001.yml
    ...
  harness.test.ts              # auto-discovers every *.yml
  helpers.ts                  # tiny util functions (≤30 LOC)
```

No `__snapshots__/` folder – we deep-equal against inline “after” trees.

---

---

## 4 Harness spec (`tests/harness.e2e.ts`)

### Responsibilities

1. **Discovery** – iterate all `tests/fixtures/*.y{a}ml`.
2. **Parse** – using `yaml` module (`bun add -D yaml`).
3. **Defaults** –
   - `strict` ⇒ `false` if absent
   - `expect` ⇒ `"success"` if absent
   - `before` / `after` ⇒ `{}` if omitted
4. **Setup FS** – `const fs = createMemoryFs(before)`.
5. **Run** –
   - `applyPatch(patch, { fs, strict })`
   - If `expect: error` ⇒ assert `DiffError`.
   - Else deep-equal `fs.snapshot()` and `after`.
6. **Test titles** – `description` or filename.
