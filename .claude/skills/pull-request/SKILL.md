---
name: pull-request
description: Open and merge a pull request in this repository. Load BEFORE writing the request body, never after. Covers the branch a batch is cut from, the mandatory template, the explicit base, the merge button, and the cleanup that follows. Triggers - "open a PR", "make a pull request", "merge it", "this goes into dev", "prepare the request", or as soon as a branch is ready to land. The user dictates in French ("ouvre une PR", "fusionne"), accept those.
---

# Opening a pull request here

## Nothing is ever pushed to dev or main

Both are protected on the remote and both are reached the same way: a branch, a pull request, and
the "Rebase and merge" button. This includes the release. A push to either is not a shortcut, it
is the thing this flow exists to prevent, and it stays refused even when the branch is a
fast-forward and even when the account could force it through.

A feature or a fix is cut from `dev` and comes back into `dev`. Cut from `dev` whenever possible:
a branch cut from the tip of another one has to be replayed with
`git rebase --onto origin/dev <old base>` after the first lands, because a plain rebase would
replay commits already in `dev` under new identities.

## The base is named IN FULL

`main` is the default branch, so a request opened without a base goes there and has to be repaired:

```bash
gh pr create --base dev --head <branch> --title "<a commit subject>" --body-file <file>
```

The title is a Conventional Commit, type and scope included. A branch spanning several scopes
takes the type of what it mainly delivers and drops the scope rather than inventing one.

## The template is not optional

**It exists: `.github/pull_request_template.md`. READ it before writing a line.** Four sections,
each expecting an answer:

1. **What changes.** One paragraph, what the branch does to the application, not how the diff is
   arranged.
2. **Why it was not already like that.** The cause, not the symptom. "It is new" is a fine answer
   for a feature.
3. **What proves it.** The suites that ran, and what was observed in the running application
   rather than assumed. A measurement beats a description.
4. **What it leaves owing.** The known gaps, or "nothing".

Plus the checklist at the foot, ticked truthfully.

**The body speaks to a stranger, and it names the defect, never the process that found it.**
Banned in a body: a date, "the review found", a numbered batch, a count of fixed items, any
workshop file. Each change is described by its own behaviour, before and after.

**A request is read diagonally, so it is written short**: two to three thousand characters,
template included.

**Write the body to a file and pass `--body-file`.** A body typed inline goes through the shell,
and backticks in it are executed: a build ran and its output landed in a published request that
way.

## Merging

- **"Rebase and merge", and nothing else.** The other two buttons are disabled on the repository,
  and squashing would throw away the reasoning each commit body carries.
- **Wait for `frontend` to be green.** The check is required and the branch must also be up to
  date with `dev`, so a branch that fell behind is rebased and force-pushed with
  `--force-with-lease` before the button will do anything.
- The remote branch leaves on its own, the repository deletes it on merge.

## After the merge

**The worktree dies with the merge, in the same gesture:**

```bash
git worktree remove <path> && git branch -D <name>
```

Without it they pile up in silence, and a directory an editor has opened refuses to be removed
later.
