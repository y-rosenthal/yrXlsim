Here is focused, actionable feedback grouped by priority.

1. Clarify Ambiguities (High Priority)
1.1 Fill processing order is underspecified
You state fill is applied first, but also say the template comes from rows and cells before fill is applied.
Problem:
If multiple fill operations depend on previous fill output, behavior could be ambiguous.
Action:


Explicitly define:


Whether each fill operation sees the output of previous fill operations.


Whether cells overrides are applied before or after fill.




Add a short “execution pipeline” summary, e.g.:


1. Parse rows
2. Apply cells overrides
3. Apply fill operations in order (each sees prior results)
4. Apply resolution rules
5. Compute used range

Make this unambiguous in one canonical sequence.

1.2 Used range rule includes formula references (but vague)
You mention referenced cells “implementation may defer this.”
Problem:
This weakens determinism. Two processors may compute different used ranges.
Action:


Either:


Remove reference-based expansion from used range (simpler, deterministic), or


Make it mandatory and specify exactly how reference parsing affects it.




If optional, clearly label it as non-normative.



1.3 Values (array form) is partially optional
You require support for A1-keyed values but allow array form optionally.
Problem:
Interoperability risk if authors use array form and some processors ignore it.
Action:


Either:


Require both forms, or


Clearly mark array form as experimental in version 0.0.1.





2. Improve Edge Case Definitions (Medium Priority)
2.1 Column/Row bounds behavior
You describe left and up, but not what happens if:


Filling left past column A


Filling up past row 1


Action:


Explicitly define:


Clamp behavior?


Error?


Ignore overflow cells?





2.2 Conflict resolution between multiple fills
You state “last operation wins.”
Good.
But add:


Whether operations are applied strictly in array order.


Whether processors MUST preserve that order.


Make this fully normative.

2.3 Formula parsing scope
You say processors MUST parse formulas and adjust relative references.
Problem:
No grammar is defined for formula parsing.
Action:


Clarify that:


Full Excel grammar is out of scope.


Only A1-style references must be recognized and adjusted.




Add a minimal reference-matching rule (e.g. regex-style description).


Without this, implementations will diverge.

3. Structural Improvements (Medium Priority)
3.1 Add a Summary Table of Processing Model
A one-page “Processor Model” section would help:


Parsing


Expansion


Resolution


Evaluation


Rendering


This makes the spec easier to implement.

3.2 Multi-sheet rule needs one clarification
You say root keys are ignored when sheets exists.
Action:
Explicitly state:

If sheets is present and non-empty, root-level rows, cells, fill, values, and meta MUST be ignored.

Right now it says “ignored for rendering” but that could allow ambiguous hybrid usage.

4. Versioning Strategy (Medium Priority)
You mention versioning but not compatibility rules.
Action:
Add:


Whether minor version increments must be backward compatible.


Whether patch increments are editorial only.


Whether processors MUST reject unknown major versions.


Example rule:


Major mismatch → MAY reject


Minor higher → SHOULD warn


Patch higher → MUST accept



5. YAML Ergonomics (Low Priority)
5.1 Consider allowing short forms
For example:
Instead of:
fill:
  - row: 2
    down: 8

You could allow:
fill:
  - row: 2
    toRow: 10

You already support this partially — emphasize it as preferred for clarity.

5.2 Consider explicit type for literal formulas
Right now:


String starting with = = formula


This prevents literal text beginning with =.
Optional improvement:
Allow:
{ formula: "=A1+1" }
{ text: "=not a formula" }

Not required now, but worth considering before 1.0.

6. Strong Points (Keep These)


Clear separation of rows vs cells


Deterministic override rule


Well-structured fill taxonomy


Normative vs non-normative clarity


Consistent example labeling


Clean used-range definition


Explicit conformance section


Structurally, this is already solid for a 0.0.x spec.

7. Highest-Impact Improvements Summary
If you change only 5 things, make them:


Define exact processing pipeline order.


Clarify used-range reference behavior (mandatory or remove).


Define overflow behavior for up/left fills.


Clarify formula parsing scope for reference adjustment.


Tighten multi-sheet root key ignoring rule.



Overall assessment:
For a 0.0.1 draft, this is unusually well-structured and implementation-ready. The main risks are interoperability drift from underspecified edge behavior — not structural flaws.
If you'd like, I can also provide a short “spec tightening rewrite” of the processing model section.
