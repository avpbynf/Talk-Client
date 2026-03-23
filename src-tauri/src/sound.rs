use rodio::buffer::SamplesBuffer;
use rodio::{OutputStream, OutputStreamHandle, Source};
use std::f32::consts::PI;

const SAMPLE_RATE: u32 = 44100;

/// Pre-computed sound buffers for instant playback.
/// All presets are generated once at startup and stored in RAM.
///
/// The `OutputStream` (which is `!Send`) lives in a dedicated parked thread.
/// Only the `OutputStreamHandle` (`Send + Sync`) is stored here.
pub struct SoundEngine {
    handle: OutputStreamHandle,
    start_beep: Vec<f32>,
    stop_beep: Vec<f32>,
    start_click: Vec<f32>,
    stop_click: Vec<f32>,
    start_chime: Vec<f32>,
    stop_chime: Vec<f32>,
}

impl SoundEngine {
    pub fn new() -> Option<Self> {
        // OutputStream wraps cpal::Stream which is !Send on Windows (WASAPI).
        // We create it in a dedicated thread that stays parked forever,
        // keeping the stream alive. Only the OutputStreamHandle (Send+Sync)
        // crosses the thread boundary.
        let (tx, rx) = std::sync::mpsc::sync_channel::<Option<OutputStreamHandle>>(1);

        std::thread::Builder::new()
            .name("sound-output".into())
            .spawn(move || {
                let Ok((_stream, handle)) = OutputStream::try_default() else {
                    let _ = tx.send(None);
                    return;
                };
                let _ = tx.send(Some(handle));
                // Park forever to keep _stream alive (zero CPU usage).
                // Thread is cleaned up when the process exits.
                loop {
                    std::thread::park();
                }
            })
            .ok()?;

        let handle = rx.recv().ok()??;

        Some(Self {
            handle,
            start_beep: gen_tone(880.0, 0.1, 0.10, 0.01, Waveform::Sine),
            stop_beep: gen_tone(440.0, 0.15, 0.10, 0.01, Waveform::Sine),
            start_click: gen_tone(1000.0, 0.05, 0.08, 0.001, Waveform::Square),
            stop_click: gen_tone(800.0, 0.05, 0.08, 0.001, Waveform::Square),
            start_chime: gen_sweep(523.25, 659.25, 0.3, 0.12, 0.01),
            stop_chime: gen_sweep(659.25, 523.25, 0.3, 0.12, 0.01),
        })
    }

    pub fn play(&self, sound_type: &str, preset: &str) {
        let samples = match (sound_type, preset) {
            ("start", "beep") => &self.start_beep,
            ("stop", "beep") => &self.stop_beep,
            ("start", "click") => &self.start_click,
            ("stop", "click") => &self.stop_click,
            ("start", "chime") => &self.start_chime,
            ("stop", "chime") => &self.stop_chime,
            _ => return,
        };

        let buffer = SamplesBuffer::new(1, SAMPLE_RATE, samples.clone());
        let _ = self.handle.play_raw(buffer.convert_samples());
    }
}

enum Waveform {
    Sine,
    Square,
}

fn gen_tone(freq: f32, duration: f32, gain_start: f32, gain_end: f32, waveform: Waveform) -> Vec<f32> {
    let num_samples = (SAMPLE_RATE as f32 * duration) as usize;
    let mut samples = Vec::with_capacity(num_samples);

    for i in 0..num_samples {
        let t = i as f32 / SAMPLE_RATE as f32;
        let progress = t / duration;

        let wave = match waveform {
            Waveform::Sine => (2.0 * PI * freq * t).sin(),
            Waveform::Square => {
                if (2.0 * PI * freq * t).sin() > 0.0 {
                    1.0
                } else {
                    -1.0
                }
            }
        };

        let gain = gain_start * (gain_end / gain_start).powf(progress);
        samples.push(wave * gain);
    }

    samples
}

fn gen_sweep(
    freq_start: f32,
    freq_end: f32,
    duration: f32,
    gain_start: f32,
    gain_end: f32,
) -> Vec<f32> {
    let num_samples = (SAMPLE_RATE as f32 * duration) as usize;
    let mut samples = Vec::with_capacity(num_samples);

    for i in 0..num_samples {
        let t = i as f32 / SAMPLE_RATE as f32;
        let progress = t / duration;

        // Phase-correct frequency sweep via integration
        let phase = 2.0 * PI * (freq_start * t + (freq_end - freq_start) * t * t / (2.0 * duration));
        let wave = phase.sin();

        let gain = gain_start * (gain_end / gain_start).powf(progress);
        samples.push(wave * gain);
    }

    samples
}
