use std::path::Path;
use thiserror::Error;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[derive(Error, Debug)]
pub enum TranscriptionError {
    #[error("Failed to load model: {0}")]
    ModelLoad(String),
    #[error("Failed to create state: {0}")]
    StateCreation(String),
    #[error("Transcription failed: {0}")]
    Transcription(String),
}

/// GPU backend for simplified selection
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GpuVendor {
    Vulkan, // AMD, Intel, or NVIDIA
    #[serde(other)]
    Cpu,    // Fallback
}

impl Default for GpuVendor {
    fn default() -> Self {
        Self::Cpu
    }
}

impl std::fmt::Display for GpuVendor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GpuVendor::Vulkan => write!(f, "Vulkan (AMD/Intel)"),
            GpuVendor::Cpu => write!(f, "CPU"),
        }
    }
}

// Keep old enum for backwards compatibility with settings
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcceleratorBackend {
    Vulkan,
    #[serde(other)]
    Cpu,
}

impl Default for AcceleratorBackend {
    fn default() -> Self {
        Self::Cpu
    }
}

impl AcceleratorBackend {
    /// Convert from GpuVendor to the appropriate backend
    pub fn from_vendor(vendor: GpuVendor) -> Self {
        match vendor {
            GpuVendor::Vulkan => AcceleratorBackend::Vulkan,
            GpuVendor::Cpu => AcceleratorBackend::Cpu,
        }
    }
}

impl std::fmt::Display for AcceleratorBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AcceleratorBackend::Cpu => write!(f, "CPU"),
            AcceleratorBackend::Vulkan => write!(f, "GPU (Vulkan)"),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GpuInfo {
    pub vendor: GpuVendor,
    pub name: String,
    pub available: bool,
    pub description: String,
}

// Keep old struct for compatibility
#[derive(Debug, Clone, serde::Serialize)]
pub struct AcceleratorInfo {
    pub backend: AcceleratorBackend,
    pub name: String,
    pub available: bool,
    pub description: String,
}

/// Detect available GPU backends
pub fn detect_available_gpus() -> Vec<GpuInfo> {
    let mut gpus = vec![];

    // Vulkan (AMD, Intel, or NVIDIA)
    #[cfg(feature = "vulkan")]
    {
        gpus.push(GpuInfo {
            vendor: GpuVendor::Vulkan,
            name: "Vulkan".to_string(),
            available: true, // Vulkan is generally available if compiled
            description: "AMD, Intel ou NVIDIA".to_string(),
        });
    }

    #[cfg(not(feature = "vulkan"))]
    {
        gpus.push(GpuInfo {
            vendor: GpuVendor::Vulkan,
            name: "Vulkan".to_string(),
            available: false,
            description: "Vulkan non compilé".to_string(),
        });
    }

    // CPU fallback
    gpus.push(GpuInfo {
        vendor: GpuVendor::Cpu,
        name: "CPU".to_string(),
        available: true,
        description: "Plus lent, toujours disponible".to_string(),
    });

    gpus
}

/// Detect available accelerators on the system (legacy, for compatibility)
pub fn detect_available_accelerators() -> Vec<AcceleratorInfo> {
    detect_available_gpus()
        .into_iter()
        .map(|gpu| AcceleratorInfo {
            backend: AcceleratorBackend::from_vendor(gpu.vendor),
            name: gpu.name,
            available: gpu.available,
            description: gpu.description,
        })
        .collect()
}

/// Get the best available accelerator (auto-detection)
pub fn get_best_accelerator() -> AcceleratorBackend {
    #[cfg(feature = "vulkan")]
    return AcceleratorBackend::Vulkan;

    #[allow(unreachable_code)]
    AcceleratorBackend::Cpu
}


pub struct WhisperEngine {
    ctx: WhisperContext,
    backend: AcceleratorBackend,
}

impl WhisperEngine {
    pub fn new_with_backend(model_path: &Path, backend: AcceleratorBackend) -> Result<Self, TranscriptionError> {
        let mut params = WhisperContextParameters::default();

        // Configure backend-specific settings
        match backend {
            AcceleratorBackend::Vulkan => {
                #[cfg(feature = "vulkan")]
                {
                    params.use_gpu(true);
                }
                #[cfg(not(feature = "vulkan"))]
                {
                    // Vulkan not compiled - CPU fallback will be used
                }
            }
            AcceleratorBackend::Cpu => {
                params.use_gpu(false);
            }
        }

        let model_path_str = model_path
            .to_str()
            .ok_or_else(|| TranscriptionError::ModelLoad("Invalid UTF-8 in model path".to_string()))?;

        let ctx = WhisperContext::new_with_params(
            model_path_str,
            params,
        )
        .map_err(|e| TranscriptionError::ModelLoad(e.to_string()))?;

        Ok(Self { ctx, backend })
    }

    pub fn backend(&self) -> AcceleratorBackend {
        self.backend
    }

    pub fn transcribe_with_progress<F>(
        &self,
        audio_data: &[f32],
        on_progress: F,
    ) -> Result<String, TranscriptionError>
    where
        F: FnMut(i32) + 'static,
    {
        self.transcribe_with_options(audio_data, None, on_progress)
    }

    /// Transcribe audio with optional vocabulary hints (initial_prompt)
    /// The vocabulary string helps Whisper recognize specific terms
    pub fn transcribe_with_options<F>(
        &self,
        audio_data: &[f32],
        vocabulary: Option<&str>,
        mut on_progress: F,
    ) -> Result<String, TranscriptionError>
    where
        F: FnMut(i32) + 'static,
    {
        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| TranscriptionError::StateCreation(e.to_string()))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        // Configure for optimal performance
        params.set_n_threads(num_cpus::get() as i32 / 2);
        params.set_language(Some("fr"));
        params.set_translate(false);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);

        // Set vocabulary hints via initial_prompt
        // This biases Whisper toward recognizing these specific terms
        if let Some(vocab) = vocabulary {
            if !vocab.is_empty() {
                params.set_initial_prompt(vocab);
            }
        }

        // Set progress callback
        params.set_progress_callback_safe(move |progress| {
            on_progress(progress);
        });

        // Run transcription
        state
            .full(params, audio_data)
            .map_err(|e| TranscriptionError::Transcription(e.to_string()))?;

        // Collect all segments
        let num_segments = state
            .full_n_segments()
            .map_err(|e| TranscriptionError::Transcription(e.to_string()))?;

        let mut result = String::new();

        for i in 0..num_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                result.push_str(&segment);
            }
        }

        Ok(result.trim().to_string())
    }

    pub fn transcribe(&self, audio_data: &[f32]) -> Result<String, TranscriptionError> {
        self.transcribe_with_progress(audio_data, |_| {})
    }
}
