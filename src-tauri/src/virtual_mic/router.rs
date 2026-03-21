use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

use super::detector::find_vbcable_device;

#[derive(Error, Debug)]
pub enum AudioRouterError {
    #[error("No input device available")]
    NoInputDevice,
    #[error("VB-Cable device not found")]
    VBCableNotFound,
    #[error("Failed to get device config: {0}")]
    DeviceConfig(String),
    #[error("Failed to build stream: {0}")]
    BuildStream(String),
    #[error("Failed to start stream: {0}")]
    StartStream(String),
}

/// Audio routing engine. Captures from the default input device (real mic)
/// and plays to the VB-Cable Input device.
pub struct AudioRouter {
    stop_signal: Arc<AtomicBool>,
    muted: Arc<AtomicBool>,
}

impl AudioRouter {
    /// Start routing real mic -> VB-Cable Input.
    /// Spawns a dedicated thread that owns both cpal streams.
    pub fn start() -> Result<Self, AudioRouterError> {
        let stop_signal = Arc::new(AtomicBool::new(false));
        let muted = Arc::new(AtomicBool::new(false));

        let stop_clone = stop_signal.clone();
        let muted_clone = muted.clone();

        // Find devices before spawning thread
        let host = cpal::default_host();
        let input_device = host
            .default_input_device()
            .ok_or(AudioRouterError::NoInputDevice)?;
        let output_device =
            find_vbcable_device().ok_or(AudioRouterError::VBCableNotFound)?;

        // Get configs
        let input_config = input_device
            .default_input_config()
            .map_err(|e| AudioRouterError::DeviceConfig(e.to_string()))?;
        let output_config = output_device
            .default_output_config()
            .map_err(|e| AudioRouterError::DeviceConfig(e.to_string()))?;

        let input_rate = input_config.sample_rate().0;
        let output_rate = output_config.sample_rate().0;
        let input_channels = input_config.channels() as usize;
        let output_channels = output_config.channels() as usize;

        // Ring buffer to pass audio between input and output callbacks
        let ring = Arc::new(Mutex::new(Vec::<f32>::with_capacity(4096)));
        let ring_writer = ring.clone();
        let ring_reader = ring.clone();

        // Channel to receive initialization result
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), AudioRouterError>>();

        std::thread::spawn(move || {
            let result = (|| -> Result<(cpal::Stream, cpal::Stream), AudioRouterError> {
                // Resampling state
                let resample_ratio = output_rate as f64 / input_rate as f64;
                let resample_buf: Arc<Mutex<Vec<f32>>> =
                    Arc::new(Mutex::new(Vec::new()));
                let resample_pos: Arc<Mutex<f64>> = Arc::new(Mutex::new(0.0));

                let resample_buf_clone = resample_buf.clone();
                let resample_pos_clone = resample_pos.clone();

                // Build input stream - capture from real mic
                let input_stream = input_device
                    .build_input_stream(
                        &input_config.into(),
                        move |data: &[f32], _: &cpal::InputCallbackInfo| {
                            // Convert to mono
                            let mono: Vec<f32> = data
                                .chunks(input_channels)
                                .map(|frame| {
                                    let sum: f32 = frame.iter().sum();
                                    sum / input_channels as f32
                                })
                                .collect();

                            // If muted, write silence
                            let samples = if muted_clone.load(Ordering::Relaxed) {
                                vec![0.0f32; mono.len()]
                            } else {
                                mono
                            };

                            // Resample to output rate if needed
                            if input_rate == output_rate {
                                let expanded: Vec<f32> = samples
                                    .iter()
                                    .flat_map(|&s| std::iter::repeat_n(s, output_channels))
                                    .collect();
                                ring_writer.lock().extend_from_slice(&expanded);
                            } else {
                                let mut buf = resample_buf_clone.lock();
                                let mut pos = resample_pos_clone.lock();
                                buf.extend(samples.iter());

                                let mut resampled = Vec::new();
                                while *pos < buf.len() as f64 - 1.0 {
                                    let idx = *pos as usize;
                                    let frac = *pos - idx as f64;
                                    let sample = buf[idx] * (1.0 - frac as f32)
                                        + buf[idx + 1] * frac as f32;
                                    for _ in 0..output_channels {
                                        resampled.push(sample);
                                    }
                                    *pos += 1.0 / resample_ratio;
                                }

                                let consumed = *pos as usize;
                                if consumed > 0 && consumed < buf.len() {
                                    buf.drain(0..consumed);
                                    *pos -= consumed as f64;
                                }

                                ring_writer.lock().extend_from_slice(&resampled);
                            }
                        },
                        |err| eprintln!("Virtual mic input error: {}", err),
                        None,
                    )
                    .map_err(|e| AudioRouterError::BuildStream(e.to_string()))?;

                // Build output stream - play to VB-Cable Input
                let output_stream = output_device
                    .build_output_stream(
                        &output_config.into(),
                        move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                            let mut ring = ring_reader.lock();
                            let available = ring.len().min(data.len());
                            data[..available].copy_from_slice(&ring[..available]);
                            for sample in &mut data[available..] {
                                *sample = 0.0;
                            }
                            ring.drain(0..available);
                        },
                        |err| eprintln!("Virtual mic output error: {}", err),
                        None,
                    )
                    .map_err(|e| AudioRouterError::BuildStream(e.to_string()))?;

                input_stream
                    .play()
                    .map_err(|e| AudioRouterError::StartStream(e.to_string()))?;
                output_stream
                    .play()
                    .map_err(|e| AudioRouterError::StartStream(e.to_string()))?;

                Ok((input_stream, output_stream))
            })();

            match result {
                Ok((input_stream, output_stream)) => {
                    let _ = tx.send(Ok(()));
                    while !stop_clone.load(Ordering::SeqCst) {
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }
                    drop(input_stream);
                    drop(output_stream);
                }
                Err(e) => {
                    let _ = tx.send(Err(e));
                }
            }
        });

        rx.recv()
            .map_err(|_| AudioRouterError::BuildStream("Router thread failed".to_string()))??;

        Ok(Self { stop_signal, muted })
    }

    /// Mute: write silence to VB-Cable instead of real audio.
    pub fn mute(&self) {
        self.muted.store(true, Ordering::SeqCst);
    }

    /// Unmute: resume forwarding real audio.
    pub fn unmute(&self) {
        self.muted.store(false, Ordering::SeqCst);
    }

    /// Check if currently muted.
    pub fn is_muted(&self) -> bool {
        self.muted.load(Ordering::SeqCst)
    }

    /// Stop routing and release resources.
    pub fn stop(&self) {
        self.stop_signal.store(true, Ordering::SeqCst);
    }
}

impl Drop for AudioRouter {
    fn drop(&mut self) {
        self.stop();
    }
}
