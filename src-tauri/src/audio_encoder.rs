use hound::{WavSpec, WavWriter};
use std::io::Cursor;

/// Encode audio samples to WAV format
///
/// # Arguments
/// * `samples` - Audio samples as f32 (range -1.0 to 1.0)
/// * `sample_rate` - Sample rate in Hz (e.g., 16000)
/// * `channels` - Number of channels (1 for mono, 2 for stereo)
///
/// # Returns
/// WAV file data as bytes
pub fn encode_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Result<Vec<u8>, String> {
    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut buffer = Cursor::new(Vec::new());
    let mut writer = WavWriter::new(&mut buffer, spec).map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    for &sample in samples {
        // Convert f32 (-1.0 to 1.0) to i16 (-32768 to 32767)
        let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
        writer
            .write_sample(sample_i16)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(buffer.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_wav_mono() {
        // Generate 1 second of 440Hz sine wave
        let sample_rate = 16000;
        let samples: Vec<f32> = (0..sample_rate)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin())
            .collect();

        let wav_data = encode_wav(&samples, sample_rate, 1).expect("Should encode WAV");

        // Check WAV header (RIFF)
        assert_eq!(&wav_data[0..4], b"RIFF");
        // Check WAV format (WAVE)
        assert_eq!(&wav_data[8..12], b"WAVE");
    }

    #[test]
    fn test_encode_wav_empty() {
        let wav_data = encode_wav(&[], 16000, 1).expect("Should encode empty WAV");
        assert!(!wav_data.is_empty());
    }
}
