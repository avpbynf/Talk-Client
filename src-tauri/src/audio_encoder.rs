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

    /// Read back the 16-bit samples a WAV carries, past its 44 byte header.
    fn samples_of(wav: &[u8]) -> Vec<i16> {
        wav[44..]
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]))
            .collect()
    }

    #[test]
    fn full_scale_samples_land_on_the_ends_of_the_range() {
        let wav = encode_wav(&[1.0, -1.0], 16000, 1).expect("should encode");
        assert_eq!(samples_of(&wav), vec![32767, -32767]);
    }

    #[test]
    fn samples_past_full_scale_clamp_instead_of_wrapping() {
        // A wrap turns the loudest part of a word into the quietest, which reads
        // as a crack in the audio and as nonsense to Whisper.
        let wav = encode_wav(&[2.0, -2.0, 100.0, -100.0], 16000, 1).expect("should encode");
        assert_eq!(samples_of(&wav), vec![32767, -32768, 32767, -32768]);
    }

    #[test]
    fn silence_stays_silent() {
        let wav = encode_wav(&[0.0, 0.0, 0.0], 16000, 1).expect("should encode");
        assert_eq!(samples_of(&wav), vec![0, 0, 0]);
    }

    #[test]
    fn a_non_finite_sample_does_not_take_the_encoder_down() {
        // cpal can hand over a NaN from a device that misbehaves. Whatever the
        // conversion makes of it, the recording must still come out.
        let wav = encode_wav(&[f32::NAN, f32::INFINITY, f32::NEG_INFINITY], 16000, 1)
            .expect("should encode");
        assert_eq!(samples_of(&wav).len(), 3);
    }

    #[test]
    fn the_header_carries_the_rate_and_the_channel_count() {
        // Whisper resamples from what the header says. A wrong rate here plays
        // the audio at the wrong speed and transcribes to nothing.
        let wav = encode_wav(&[0.0; 10], 16000, 1).expect("should encode");
        assert_eq!(u16::from_le_bytes([wav[22], wav[23]]), 1);
        assert_eq!(
            u32::from_le_bytes([wav[24], wav[25], wav[26], wav[27]]),
            16000
        );

        let stereo = encode_wav(&[0.0; 10], 44100, 2).expect("should encode");
        assert_eq!(u16::from_le_bytes([stereo[22], stereo[23]]), 2);
        assert_eq!(
            u32::from_le_bytes([stereo[24], stereo[25], stereo[26], stereo[27]]),
            44100
        );
    }
}
