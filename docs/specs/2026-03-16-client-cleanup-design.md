# Client Cleanup and GPU Simplification

Spec de refactoring pour nettoyer le dead code legacy et simplifier la stack GPU du client.

## Probleme

Le client contient du dead code issu de Whisper Flow (fonctions clipboard avec images,
`build_vocabulary`, variantes GPU non utilisees) et des features Cargo inutiles
(cuda, metal, intel-sycl). Cela genere 4 warnings au build et de la confusion
pour les futurs contributeurs.

## Approche

3 axes de nettoyage, tous independants :

### Axe 1 — Dead code (deja applique en session)

| Fichier | Suppression |
|---|---|
| `context_detection/mod.rs:16` | Export `build_vocabulary` retire du `pub use` |
| `context_detection/selector.rs:133+` | Fonction `build_vocabulary` supprimee |
| `clipboard/mod.rs:83+` | `copy_text_and_images_then_paste` supprimee (windows + not(windows)) |
| `clipboard/mod.rs:154+` | `type_text_with_images` supprimee (windows + not(windows)) |

### Axe 2 — Simplification GPU (Cargo.toml deja applique)

**Cargo.toml** : seule feature restante = `vulkan` (+ CPU par defaut).

**Enums a simplifier** dans `transcription/mod.rs` :
- `GpuVendor` : retirer `Cuda`, `Metal`, garder `Vulkan`, `Cpu`
- `AcceleratorBackend` : retirer `Cuda`, `IntelSycl`, `Metal`, garder `Vulkan`, `Cpu`
- `from_vendor()` : simplifier le match
- `get_best_accelerator()` : priorite Vulkan > CPU uniquement
- `WhisperEngine::new_with_backend()` : retirer les branches cuda/metal/intel-sycl
- `detect_gpus()` : retirer la detection CUDA et Metal
- `Display` impls : retirer les variantes supprimees

**Fichiers impactes** :
- `transcription/mod.rs` : enums, detection, engine init
- `settings.rs` : `default_accelerator` (deja CPU, pas de changement)
- `lib.rs` : references a `AcceleratorBackend` (pas de changement structurel)

**Attention** : le frontend (TranscriptionView.tsx) affiche les backends disponibles.
Verifier que l'UI ne crash pas si les variantes disparaissent du JSON serialise.

### Axe 3 — Corrections mineures (deja appliquees en session)

| Fichier | Correction |
|---|---|
| `tauri.conf.json` | CSP elargi pour HTTP local/LAN |
| `tauri.conf.json` | devUrl port 1420 -> 1421 |
| `vite.config.ts` | port 1420 -> 1421, HMR 1421 -> 1422 |
| `hotkeys/mod.rs:625` | Ne plus envoyer `detected_context.language` comme code Whisper |
| `TranscriptionView.tsx` | Import `Switch` inutilise supprime |

## Fichiers a modifier (restant)

| Fichier | Action |
|---|---|
| `src-tauri/src/transcription/mod.rs` | Simplifier enums GPU, detection, engine init |

## Criteres de succes

- `cargo check --features vulkan` : zero warning
- `bun run tauri build --features vulkan` : build OK
- L'app demarre et fonctionne en mode server et local (CPU/Vulkan)
