<!--
The template for the ONE pull request that targets `main`. Open it with

    gh pr create --base main --head dev --template release.md

or by adding `?template=release.md` to the compare URL. Every other pull request targets `dev` and
uses the default template, which asks what a batch changes; this one asks nothing of the sort,
because a release changes nothing. Everything in it has already entered `dev` through a pull request
of its own.

**DO NOT PRESS A MERGE BUTTON ON THIS ONE.** All three rewrite, and `main` is already an ancestor of
`dev`, so replaying `dev` onto it hands `main` a second copy of every commit under a fresh hash.
That is not a hypothesis: it was done on 0.8.0 and cost a reset of `main` and a tag moved onto the
commit `dev` already held. What merges this is a fast-forward from a terminal,

    git push origin origin/dev:main

and the pull request closes itself as merged once its commits are on `main`. The tag goes on after
that and never before it, because the tag is what publishes.
-->

## What this publishes

<!--
One paragraph, for somebody reading the release later and not for a reviewer: what they get that
they did not have. Not a commit list, the changelog already is one.
-->

## The version

- Tag: `v`
- `version` in `src-tauri/tauri.conf.json`:
- The same number in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`.
- The changelog section is named after it, and `Unreleased` is gone or empty.

<!--
The tag and the manifest are one number written twice, and `release.yml` compares them before it
builds anything. A disagreement stops the run, which is the one mistake that would otherwise publish
an installer under a version the application itself does not claim, and an update nothing would ever
be offered.
-->

## What the release carries that no changelog entry names

<!--
The question this template exists for. Read `git log origin/main..origin/dev` against the section
you just named, batch by batch. A batch that changed what somebody sees and left no line ships mute.
"Nothing" is the answer you want, and it is worth having checked.
-->

## What proves it

<!--
- `bun run build` and `bun run test` green on `dev` at the commit being tagged, not on a branch
  before it.
- `bun run test:rust`, or say plainly that the native side was not compiled.
- Anything tried in the running application since the last release, and what was observed.
- Say what has NOT been looked at. A release is allowed to carry that; a silent one is not.
-->

---

- [ ] `main` is an ancestor of `dev`, so this merges by fast-forward.
- [ ] The version is the same in the four files, and the tag agrees with it.
- [ ] The changelog section is named after the tag, and the range was read against it.
- [ ] Merged by fast-forward from a terminal, and by no button.
- [ ] The tag is pushed only once its commits are on `main`, because the tag is what publishes.
