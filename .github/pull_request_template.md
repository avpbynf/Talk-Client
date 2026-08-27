<!--
Merge with "Rebase and merge" and with nothing else. "Create a merge commit" forks the tree, and
"Squash and merge" throws away the per-commit reasoning the bodies hold. If the rebase button is
greyed out, this branch is behind `dev`; rebase it locally and force-push rather than merging
`dev` into it.

The base is `dev`. A request opened against `main` is a mistake to repair, not a shortcut: `main`
only ever receives `dev`, in one request that is the deployment.
-->

## What changes

<!-- One paragraph. What the branch does to the application, not how the diff is arranged. -->

## Why it was not already like that

<!--
The cause, not the symptom. What the code did instead, and what made that the wrong thing: a
default that was never set, a stream bound to a device that moved, a figure read against the
wrong scale. "It is new" is a fine answer for a feature.
-->

## What proves it

<!--
Say which of these the claim rests on. An unticked line is not a failure, it is a scope.

- `bun run test` and `bun run build`, which is the same tsc pass the release runs.
- `bun run test:rust`, and whether the native side was compiled at all.
- On the machine: what was done in the running application, and what was observed rather than
  assumed. Numbers read off a log or a measurement carry more than a description.
-->

## What it leaves owing

<!-- Known gaps, anything a later branch has to finish, or "nothing". -->

---

- [ ] Rebased onto `dev`, so the merge is a fast-forward.
- [ ] `bun run build` and `bun run test` green locally, after the rebase and not before it.
- [ ] `bun run tauri:check` green, or the branch touches no Rust.
- [ ] Every place that states a fact this branch changed now states the new one: `README.md`,
      `CLAUDE.md`, the comments around the code, and what the interface itself says.
