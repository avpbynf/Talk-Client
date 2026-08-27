---
name: release
description: Cut, tag and publish a version of the client. Load BEFORE bumping a version or touching a tag, never after a failed attempt. Covers the release branch, where the version lives, the changelog, how dev reaches main, and what actually publishes. Triggers - "release", "publish", "cut a version", "tag it", "ship it", "sors la version", "on balance une release".
---

# Releasing here

## The shape

1. A branch off `dev`, named for the version, carrying **one commit that raises the version** and
   the regenerated changelog.
2. That branch lands on `dev` by pull request, like anything else.
3. A pull request from `dev` to `main`, merged by the button. That request is the deployment.
4. **The tag on `main` is what publishes.** `release.yml` runs on tags and on nothing else.

Nothing in this is pushed. `dev` and `main` are both reached by pull request, and the deployment
replays the commits under new identities, so `main` holds its own rather than the ones `dev`
carries. The contents are identical, and the next deployment skips what is already applied.

## The version bump lands LAST

It is the last commit to reach `dev` before the deployment request, alone on its commit, so the
tip of `main` at a release names the version it is. **A batch that lands on top of a bump has
undone it**, and needs a fresh bump before anything is tagged.

The version lives in four places and they move together:

- `package.json`
- `src-tauri/tauri.conf.json`, which is what the installer and the updater compare against
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`, in the `talk` entry

## The changelog is generated, not written

```bash
git-cliff --tag vX.Y.Z -o CHANGELOG.md
```

It reads the commit bodies, which is the reason those bodies are written carefully in the first
place. Before running it, check the section it would write into is not already tagged:

```bash
git tag --sort=-creatordate | head -3
```

A tagged section is a version people are running, and adding to it rewrites its record.

## Tagging

The tag goes on the tip of `main` once the deployment request has landed, and it is created
against the remote rather than pushed:

```bash
gh api repos/avpbynf/Talk-Client/git/refs -f ref=refs/tags/vX.Y.Z -f sha=<full sha of main>
```

The sha is the full forty characters. Then watch what it started:

```bash
gh run list --workflow=release.yml --limit 1
```

The build compiles whisper.cpp from source, so it takes around twenty minutes. It produces the
NSIS installer, its signature, and the release the updater reads.

## What the updater needs

The client checks the releases page and compares against `tauri.conf.json`. A release therefore
proves nothing about the updater on its own: it is the version after it that shows whether an
installed copy finds and takes it.
