# Talk-Client

Tauri v2 desktop Speech-to-Text app, Windows only. Rust backend, React 19 frontend.
See [README.md](README.md) for features, build requirements and troubleshooting.

## Commands

```bash
bun install
bun run tauri:dev      # dev build, MSVC env loaded by scripts/vcenv.bat
bun run tauri:build    # production installer
bun run tauri:check    # cargo check, no full build
bun run dev            # frontend alone, no Tauri shell
bun run test           # frontend suite, vitest on jsdom
bun run test:coverage  # same, with a coverage report
bun run test:rust      # cargo test, MSVC env loaded the same way
```

Run `bun run tauri:check` before committing. The native side compiles whisper.cpp,
so a cold build takes a long while. `tauri:check` is the fast feedback loop.

`bun run test` is the fast one: it never touches the native side, so it answers in
seconds. `test:rust` pays the whisper.cpp build the first time in any fresh worktree.

Call cargo through `test:rust` and not directly. `cargo test` on its own inherits
whatever environment the shell has, and without the MSVC one loaded the native
build fails in ways that read like a Rust error.

## Layout

- `src-tauri/src/lib.rs` registers commands and owns app state
- `src-tauri/src/transcription/`, `models/`, `audio/` are the local engine
- `src-tauri/src/server_transcription.rs` is the remote path
- `src-tauri/src/virtual_mic/` detects and routes through VB-Cable
- `src/views/` are the settings pages, `src/pages/` the overlay and setup wizard

## Branches

`dev` is what accumulates, `main` is what ships. Both are protected on the remote: no
direct push, no force push, no deletion, linear history, and the `frontend` check green
before anything merges.

- **A feature or a fix takes its own branch off `dev`**, and comes back into `dev`
  through a pull request. Several pile up there, which is what makes a beta possible
  without having decided anything about a release.
- **`main` only ever receives `dev`**, through a single pull request carrying everything
  ready to ship. That pull request is the deployment, and the version is tagged on `main`
  afterwards, which is what `release.yml` builds the installer from.
- Nothing is committed on `dev` or `main` directly, this session included.
- **`main` stays the default branch**, since it is what the repository page shows and
  what a clone lands on, and it is where the releases hang. The cost is that a new pull
  request opens against `main` unless it is told otherwise, so naming `dev` as the base
  is part of opening one.
- **A pull request title is a Conventional Commit like any other.** It is what the
  repository shows for that branch forever, and what a squash would write into the
  history. A branch spanning several scopes takes the type of what it mainly delivers and
  drops the scope rather than inventing one.
- **Branches come back by rebase**, which keeps the commits as they were written and
  keeps the history linear, as the protection demands. Squashing would throw away the
  reasons written into each message and leave one line for a batch of unrelated work.
  `dev` into `main` lands by fast-forward, so `main` stays an exact prefix of `dev`.
- **`.github/pull_request_template.md` is not optional.** It is read before the body is
  written, and every section gets an answer. The body speaks to a stranger and names the
  defect, never the process that found it: no dates, no "the review found", no internal
  file. Two to three thousand characters, template included.

## Conventions

- English in code and comments
- Conventional Commits, in commit messages and pull request titles alike
- Everything is written LF, and a CRLF appearing is a tooling regression

## Things that bite

- **Build environment.** `scripts/vcenv.bat` finds `vcvarsall.bat` through vswhere and
  loads the MSVC x64 environment. Never add a redirection inside its vswhere
  backticks: escaping one breaks the quoted path and the probe silently finds
  nothing. `vcvarsall.bat` is itself noisy on stderr even on success, which is why the
  call is silenced and judged on its exit code.
- **Path length.** `vulkan-shaders-gen` nests its CMake scratch directories about 220
  characters deep on their own, so the checkout has to stay short, well under 50
  characters. The symptom is misleading: CMake reports that the C compiler cannot
  build a trivial program, naming a `TryCompile-*` directory rather than the length.
  A short checkout is not always enough either, since the target directory sits in
  the middle of that path. CI sets `CARGO_TARGET_DIR` to a root-level directory, and
  a local build needs the same. From `Documents\GitHub\t4lk\Talk-Client`, which is
  only 48 characters, the default target directory still crosses the limit, and the
  message that comes back is MSBuild's `MSB4184` rather than anything about CMake.
- **GPU is optional.** `vulkan` is a default feature, and `--no-default-features` builds
  without the Vulkan SDK.
- **The VB-Cable payload is absent.** `src-tauri/nsis-hooks.nsh` ships
  `src-tauri/resources/VBCABLE_Driver/` and runs its setup at install time, but those
  binaries were Git LFS objects and the objects are gone from the remote. Fetch
  VB-Cable from vb-audio.com and unpack it there before building an installer.
- **There are two modes and `Local` is the default.** `TranscriptionMode` is picked in
  the setup wizard and changed on the Transcription page. Neither is a degraded
  version of the other. `server_fallback` applies inside server mode only, so a
  machine dictating badly may be in server mode falling back silently, or in local
  mode with a bad model. Check which mode it is in before anything else.
- **The old name still points at real data, and not where you would guess.**
  `ProjectDirs::from("com", "avpbynf", "t4lk")`, called in four places, resolves on
  Windows to `%APPDATA%\avpbynf\t4lk`: the crate drops the qualifier, and only the
  last argument carries the name. `settings.json`, `t4lk.db` and the downloaded
  models all live there, better than a gigabyte of them. The bundle identifier
  `com.avpbynf.t4lk` is a separate string that names the WebView2 profile under
  `%LOCALAPPDATA%`, and nothing worth keeping is under it. Renaming either needs a
  migration written first, not a find and replace.
- **`AppTheme` carries a `serde(alias)` on each of its two renamed variants.**
  `load_settings()` drops the whole file on a parse error and returns the defaults,
  so a settings file still holding `t4lk-dark` would take the server URL, the token
  and the shortcuts down with it.
- **The uninstall key is the product name, not the identifier.** Tauri builds it as
  `Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}`, so renaming
  the product makes every earlier install invisible to the new one and Windows lists
  two applications. `NSIS_HOOK_PREINSTALL` retires the `T4lk` entry by deleting its
  keys and its directory. It must never do that by running the old uninstaller, whose
  own hook reaches into the data directory. Any future rename needs the same treatment.
- **The installer bitmaps carry the wordmark.** `src-tauri/icons/nsis-header.bmp` and
  `nsis-sidebar.bmp` are 24-bit BMP at sizes NSIS fixes, so they cannot be produced by
  the build. `python scripts/make-installer-images.py` redraws both from the real icon
  and the real Outfit face. Run it after any change to the mark.
- **Feedback loops are not symmetric.** The frontend checks in seconds with
  `bun run build`, which is the same `tsc` pass the release runs. The Rust side cannot
  be checked at all without CMake, Ninja, the Vulkan SDK and an LLVM install, because
  `whisper-rs-sys` compiles whisper.cpp from its build script and generates its
  bindings with bindgen. Even `cargo check` runs both. Missing LLVM is the one that
  misleads, since bindgen panics about `libclang.dll` and names no file of ours. On a
  machine without them, CI is the only verification and the loop is roughly twenty
  minutes, so read Rust changes carefully before pushing rather than iterating on the
  runner.
