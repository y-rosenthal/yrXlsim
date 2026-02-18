# What’s in the `docs/` folder

This file explains what each document in `docs/` is for, who it’s for, the intended reading order, and how to keep everything in sync—especially when you’re revising the project alone or making breaking changes.

---

## Contents and audience

| File / folder | What it contains | Audience |
|---------------|------------------|----------|
| **PRD.md** | Product Requirements Document: product goals, functional requirements, tech stack, CLI behavior, Quarto integration. Combines “what we’re building” and high-level “how.” | Product owner, developers (onboarding and design decisions). |
| **YAML-SPEC-v0.0.2.md** | **Current** normative specification for the yrXlsim YAML format. Defines document structure, processing pipeline, fill, values, meta, multi-sheet, error handling, etc. This is the source of truth for the format. | Implementers, spec readers, anyone changing format behavior. |
| **YAML-SPEC-v0.0.1.md** | **Previous** version of the YAML spec (0.0.1). Kept for history and for understanding what changed in 0.0.2. | Maintainers, anyone debugging or migrating from old behavior. |
| **USER-GUIDE.md** | How to create and edit yrXlsim sheets in YAML: rows, cells, fill, values, meta, quick start, and common patterns. Written for authors and editors; defers full technical rules to the spec. | Authors, editors, tutorial readers. |
| **TESTING.md** | How the test suites work (core + CLI), how to run them, what they cover, and implementation details (e.g. globals, paths). | Developers writing or running tests. |
| **.YAML-SPEC-v0.0.2.md-supportingDocs/** | Supporting material used when revising the spec (e.g. LLM analyses of v0.0.1: `claudeAnalysisOfv0.0.1spec.md`, `chatgptAnalysisOfv0.0.1spec.md`). Not normative. | Spec authors/maintainers when doing spec revisions. |

---

## Recommended reading order (first time)

For someone new to the project, this order works well:

1. **PRD.md** — Understand goals, scope, and high-level design.
2. **YAML-SPEC-v0.0.2.md** — Understand the format that the code must implement (at least §1–2 and the parts you’ll touch).
3. **USER-GUIDE.md** — See how the format is used in practice.
4. **TESTING.md** — See how to run and extend tests.

The older **YAML-SPEC-v0.0.1.md** and the **.YAML-SPEC-v0.0.2.md-supportingDocs/** folder are optional; use them when you care about spec history or past revision rationale.

---

## Keeping the docs up to date

When you change behavior, UI, or the format, update the relevant docs in the same pass. That keeps the codebase and documentation from drifting.

- **Best order when revising docs** (especially with an LLM): work from “source of truth” outward:
  1. **YAML-SPEC** (if the format or processing changes) — this defines the contract.
  2. **PRD** (if goals, requirements, or high-level design change).
  3. **USER-GUIDE** (so it matches the spec and current features).
  4. **TESTING** (if test layout, commands, or coverage change).
  5. **Root README.md** (if quick examples, usage, or “what’s in this repo” change).

Going in this order reduces contradictions: spec first, then product/design, then user-facing text, then tests and top-level README.

---

## Making breaking changes (solo maintainer workflow)

When you’re the only one working on the project and you need to make **breaking** changes (e.g. format or CLI behavior), doing docs before code helps you think through the change and keeps the repo consistent. Suggested sequence:

### 1. Decide and document the contract first

- **First:** Update **YAML-SPEC-v0.0.2.md** (or create a new spec version file and point the project to it). Define the new behavior, pipeline, and rules. Bump the spec `version` (e.g. 0.0.2 → 0.0.3) and note compatibility (e.g. “major/minor/patch” and how old docs are treated).
- **Second:** If the change affects product goals or scope, update **PRD.md** (requirements, CLI behavior, Quarto behavior).

Do **not** start coding the breaking behavior until the spec (and if needed the PRD) describes what “done” looks like. That gives you a clear target and avoids coding first and then bending the spec to the code.

### 2. Update user-facing docs

- **Third:** Update **USER-GUIDE.md** so examples, explanations, and quick start match the new spec. If something is removed or renamed, say so and point to the current spec.
- **Fourth:** Update the root **README.md** (examples, “YAML format at a glance,” links to `docs/YAML-SPEC-…` and `docs/USER-GUIDE.md`).

### 3. Implement and test

- **Fifth:** Implement the change in code (core, CLI, Quarto integration) so they match the updated spec.
- **Sixth:** Update or add tests (**TESTING.md** and the test files) so they validate the new behavior and document how to run them.

### 4. Optional: preserve history

- If you introduced a new spec version (e.g. 0.0.3), keep the old spec file(s) (e.g. `YAML-SPEC-v0.0.1.md`, `YAML-SPEC-v0.0.2.md`) in `docs/` for reference. You can add a short note at the top of the new spec or in this README about what changed.

**Summary for breaking changes:**

| Step | Action | When to code |
|------|--------|--------------|
| 1 | Update **YAML-SPEC** (and PRD if needed) | After this — spec is the contract. |
| 2 | Update **USER-GUIDE** and root **README** | Can be in parallel with or just before coding. |
| 3 | **Code** to the new spec | After step 1 (and 2 if you want examples locked in first). |
| 4 | Update **TESTING** and test code | After or alongside implementation. |

When using an LLM to help revise docs, feed it the spec first, then the PRD, then the USER-GUIDE and README, in that order, so it keeps the “spec as source of truth” and doesn’t contradict the contract.

---

## Quick reference

- **“What should I read first?”** → PRD → YAML-SPEC-v0.0.2 → USER-GUIDE → TESTING.
- **“I’m changing the YAML format or processing.”** → Update YAML-SPEC first, then USER-GUIDE and README, then code and tests.
- **“I’m making a breaking change and I work alone.”** → Spec (and PRD if needed) → USER-GUIDE + README → code → tests; use this README’s “Making breaking changes” section as the checklist.
