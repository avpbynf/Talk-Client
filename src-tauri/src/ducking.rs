//! Turning the machine down while you talk, and putting it back after.
//!
//! This replaces sending MediaPlayPause at whatever happened to be in front,
//! which hit the wrong application as often as the right one and could not be
//! undone when it guessed wrong. Lowering the render endpoint touches
//! everything at once and is exactly reversible.
//!
//! The level taken before ducking is persisted rather than held in memory. If
//! the application dies mid-recording, the machine is left quiet and nothing
//! in it knows why; the next launch reads that value back and restores it.

/// Read the master volume of the default render endpoint, 0.0 to 1.0.
#[cfg(windows)]
pub fn current_volume() -> Option<f32> {
    with_endpoint(|volume| unsafe { volume.GetMasterVolumeLevelScalar().ok() })
}

/// Set the master volume of the default render endpoint, 0.0 to 1.0.
#[cfg(windows)]
pub fn set_volume(level: f32) -> bool {
    let level = level.clamp(0.0, 1.0);
    with_endpoint(|volume| unsafe {
        volume
            .SetMasterVolumeLevelScalar(level, std::ptr::null())
            .ok()
            .map(|_| ())
    })
    .is_some()
}

#[cfg(windows)]
fn with_endpoint<T>(
    f: impl FnOnce(&windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume) -> Option<T>,
) -> Option<T> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    unsafe {
        // Already-initialised is not an error here: the peak meter does the same
        // and the recording path may have got there first.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        let volume = device
            .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
            .ok()?;
        f(&volume)
    }
}

#[cfg(not(windows))]
pub fn current_volume() -> Option<f32> {
    None
}

#[cfg(not(windows))]
pub fn set_volume(_level: f32) -> bool {
    false
}

/// The level to duck to, from a stored percentage.
///
/// Clamped rather than trusted: the value comes back from a settings file that
/// a person can edit, and a percentage above a hundred would raise the volume
/// on somebody who asked for the opposite.
pub fn level_from_percent(percent: u8) -> f32 {
    (percent.min(100) as f32) / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    // The endpoint calls need a sound card and a session, so they are not
    // exercised here. The arithmetic between the slider and the API is, since
    // that is where an off-by-one-hundred would be silent and loud.

    #[test]
    fn a_percentage_becomes_a_scalar() {
        assert_eq!(level_from_percent(0), 0.0);
        assert_eq!(level_from_percent(20), 0.2);
        assert_eq!(level_from_percent(100), 1.0);
    }

    #[test]
    fn a_percentage_over_a_hundred_does_not_turn_the_volume_up() {
        assert_eq!(level_from_percent(255), 1.0);
    }
}
