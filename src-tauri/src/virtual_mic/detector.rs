use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualAudioStatus {
    pub installed: bool,
    pub device_name: Option<String>,
}

/// Detect whether Virtual Audio Driver is installed by enumerating audio
/// output devices and matching by name ("Virtual Audio Driver").
pub fn detect_virtual_audio() -> VirtualAudioStatus {
    let host = cpal::default_host();

    let device = host.output_devices().ok().and_then(|devices| {
        devices
            .filter_map(|d| {
                let name = d.name().ok()?;
                if name.contains("Virtual Audio Driver") {
                    Some(name)
                } else {
                    None
                }
            })
            .next()
    });

    VirtualAudioStatus {
        installed: device.is_some(),
        device_name: device,
    }
}

/// Find the Virtual Audio Driver output device (speaker endpoint).
/// Returns None if the driver is not installed.
pub fn find_virtual_audio_device() -> Option<cpal::Device> {
    let host = cpal::default_host();

    host.output_devices().ok()?.find(|d| {
        d.name()
            .map(|n| n.contains("Virtual Audio Driver"))
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_virtual_audio_returns_valid_status() {
        let status = detect_virtual_audio();
        if !status.installed {
            assert!(status.device_name.is_none());
        }
        if status.installed {
            assert!(status.device_name.is_some());
        }
    }
}
