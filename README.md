<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" alt="">
</p>

<h1 align="center">Talk</h1>

<p align="center">
  Hold a key, say the sentence, and it is typed where you were already working.
</p>

<p align="center">
  <a href="https://github.com/avpbynf/Talk-Client/releases"><img src="https://img.shields.io/github/v/release/avpbynf/Talk-Client?style=flat-square&label=download&color=6366f1" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platform-Windows-6366f1?style=flat-square" alt="Windows">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-6366f1?style=flat-square" alt="MIT"></a>
</p>

---

Dictation is faster than typing, and it goes mostly unused because the good engines send
your voice to a company and the ones that run locally mishear every proper noun you care
about. Talk is the third option: your own machine records, your own GPU transcribes, and
the text lands in the window that already had focus. No account, no upload, no tab to
switch to.

It is one half of a pair. [Talk-Server](https://github.com/avpbynf/Talk-Server) holds a
large Whisper model on a real card and answers the OpenAI transcription API; this app
records the audio, sends it there, and puts the answer where the cursor is. Point it at
a server and it uses one. Do not, and it runs whisper.cpp locally on Vulkan instead.

**It falls back on its own.** When the server does not answer, the local engine takes
over mid-shortcut and you keep dictating. That is the whole reason the second engine
exists: a machine on the other side of the house being off should cost you accuracy, not
the ability to talk. The trade has one price worth knowing about, which is that a real
bug and an unreachable server look identical from the outside, since both end in the
same silent fallback. When transcriptions get worse for no reason, the Transcription
page and the server URL on it are the first place to look.

## Quick start

Take the installer from the [releases](https://github.com/avpbynf/Talk-Client/releases)
page and run it. It asks for no elevation and installs for the current user only.

The first launch opens a wizard: pick a model, then either give it a server URL and
token or skip that and stay local. The GGML model is not bundled, so the first local
transcription downloads it from HuggingFace and caches it in AppData, which keeps the
installer itself down to a few megabytes.

Then hold the shortcut and talk.

## What it does

**Recording is a global shortcut**, push-to-talk or toggle, from any window. A small
overlay shows what is being heard, and it can be dragged wherever it is not in the way.

**The text goes in by keystroke or through the clipboard.** Typing it straight into the
focused window is the default and needs no paste; the clipboard route is there for the
applications that refuse synthetic input.

**A vocabulary biases the model toward your words.** Product names, colleagues,
libraries, anything Whisper would otherwise turn into the nearest common word. It is a
plain list, typed once.

**History is local and searchable**, capped so it does not grow forever, and the
statistics page reads from it: how much you dictated, how much time that saved against
typing it, and where it went.

**Meeting mode routes the microphone through VB-Cable**, so a call keeps hearing you
while Talk captures the same input. Media playing on the machine is paused for the
length of a recording, and only when something is actually audible, which is what keeps
it from starting something that was deliberately stopped.

It starts with Windows and lives in the tray, if you want it to.

## Building

Windows only. The native side compiles whisper.cpp from source, so budget a long first
build.

| Requirement | Notes |
|---|---|
| Rust 1.90 | pinned by `src-tauri/rust-toolchain.toml` |
| [Bun](https://bun.sh) | frontend package manager and task runner |
| Visual Studio 2022 | "Desktop development with C++" workload, Community or Build Tools |
| CMake and Ninja | needed to build whisper.cpp |
| LLVM | `whisper-rs-sys` generates its bindings with bindgen, which loads `libclang.dll` |
| Vulkan SDK | only for the default `vulkan` feature |

```bash
bun install
bun run tauri:dev
```

`bun run tauri:build` produces the installer, and `bun run tauri:check` runs `cargo
check` without a full build. Use the `tauri:` scripts rather than calling `tauri`
directly: they go through `scripts/vcenv.bat`, which loads the MSVC environment CMake
needs.

To build without a GPU backend, and skip the Vulkan SDK entirely, drop the default
feature:

```bash
cargo build --manifest-path src-tauri/Cargo.toml --no-default-features
```

### When the build fails

- **`cl.exe` not found.** The MSVC environment was not loaded. Run the `bun run tauri:`
  scripts rather than calling `tauri` directly.
- **A bindgen panic about `libclang`.** LLVM is not installed, or not where bindgen
  looks. Install it, or point `LIBCLANG_PATH` at the directory holding `libclang.dll`.
  The panic names no file of this project, which makes it read like a broken dependency;
  it is not one.
- **A path that is too long.** `vulkan-shaders-gen` nests its own build tree around 220
  characters deep, and the default target directory sits under the checkout, so the two
  together cross the Windows limit. MSBuild says so plainly, as `MSB4184` naming a path
  it cannot normalise; CMake, reached the same way, instead claims the C compiler cannot
  build a trivial program. Point the build somewhere short, which is what CI does:

  ```bash
  CARGO_TARGET_DIR=C:\rust-target bun run tauri:build
  ```

  The deepest file the build writes sits 219 characters below that directory, so
  anything up to about 40 characters works and a path under `Documents` does not.
  Moving the checkout helps too, but the target directory is the half that grows.
- **Meeting mode reports VB-Cable missing.** The app detects
  [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) by enumerating audio devices,
  and the NSIS installer is what installs the driver. A source build, or a declined
  prompt, leaves you without it: install it by hand and restart the app.

### Building the installer

`bun run tauri:build` runs `src-tauri/nsis-hooks.nsh`, which ships the contents of
`src-tauri/resources/VBCABLE_Driver/` and runs `VBCABLE_Setup_x64.exe` at install time.
Those driver binaries are not in the repository, since VB-Audio redistributes them under
its own terms: fetch the package from [vb-audio.com](https://vb-audio.com/Cable/) and
unpack it there before building an installer. Everything else builds without them.

The two bitmaps the wizard displays are committed next to the icons, and rebuilt by
`python scripts/make-installer-images.py` whenever the mark or the wordmark changes.

## Licence

MIT, see [LICENSE](LICENSE).
