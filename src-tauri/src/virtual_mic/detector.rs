use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VBCableStatus {
    pub installed: bool,
    pub device_name: Option<String>,
}

/// Detect whether VB-Cable is installed by enumerating audio output devices
/// and matching by name (contains "CABLE Input" or "VB-Audio Virtual Cable").
pub fn detect_vbcable() -> VBCableStatus {
    let host = cpal::default_host();

    let device = host.output_devices().ok().and_then(|devices| {
        devices
            .filter_map(|d| {
                let name = d.name().ok()?;
                if name.contains("CABLE Input") || name.contains("VB-Audio Virtual Cable") {
                    Some(name)
                } else {
                    None
                }
            })
            .next()
    });

    VBCableStatus {
        installed: device.is_some(),
        device_name: device,
    }
}

/// Find the VB-Cable Input device (output device from cpal's perspective).
/// Returns None if VB-Cable is not installed.
pub fn find_vbcable_device() -> Option<cpal::Device> {
    let host = cpal::default_host();

    host.output_devices().ok()?.find(|d| {
        d.name()
            .map(|n| n.contains("CABLE Input") || n.contains("VB-Audio Virtual Cable"))
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_vbcable_returns_valid_status() {
        let status = detect_vbcable();
        if !status.installed {
            assert!(status.device_name.is_none());
        }
        if status.installed {
            assert!(status.device_name.is_some());
        }
    }
}
