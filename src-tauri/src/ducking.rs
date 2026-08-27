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

/// How long a slide takes. Down is quicker than up: the point of going down is
/// to get out of the way of the speaker, while coming back sounds natural only
/// if it takes its time.
pub const FADE_DOWN_MS: u64 = 140;
pub const FADE_UP_MS: u64 = 320;

/// How many levels a slide is cut into. Twelve steps over a tenth of a second
/// is below what an ear hears as separate, and each one is a call across COM,
/// so more would cost without being heard.
#[cfg(windows)]
const FADE_STEPS: u32 = 12;

/// The slide currently allowed to move the volume.
///
/// A recording stopped as fast as it started leaves two slides running at once,
/// pulling in opposite directions. Each takes a ticket on the way in and stops
/// as soon as a newer one exists, so the last order given is the one that wins.
#[cfg(windows)]
static FADE_TICKET: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Slide the master volume to `level` over `millis`, rather than jumping.
///
/// Blocks for the length of the slide, so callers on a path that has to answer
/// quickly give it its own thread.
#[cfg(windows)]
pub fn fade_volume(level: f32, millis: u64) -> bool {
    use std::sync::atomic::Ordering;

    let level = level.clamp(0.0, 1.0);
    let ticket = FADE_TICKET.fetch_add(1, Ordering::SeqCst) + 1;
    let step_millis = (millis / FADE_STEPS as u64).max(1);

    with_endpoint(|volume| unsafe {
        let from = volume.GetMasterVolumeLevelScalar().ok()?;

        for step in 1..=FADE_STEPS {
            if FADE_TICKET.load(Ordering::SeqCst) != ticket {
                // A newer slide is running, and it started from wherever this
                // one had got to. Leaving now is what keeps the two from
                // fighting over the same endpoint.
                return Some(());
            }

            let progress = step as f32 / FADE_STEPS as f32;
            let next = from + (level - from) * progress;
            volume
                .SetMasterVolumeLevelScalar(next.clamp(0.0, 1.0), std::ptr::null())
                .ok()?;
            std::thread::sleep(std::time::Duration::from_millis(step_millis));
        }

        Some(())
    })
    .is_some()
}

#[cfg(not(windows))]
pub fn fade_volume(_level: f32, _millis: u64) -> bool {
    false
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

/// The level to duck to: a share of where the machine already sits.
///
/// The percentage is read against the current level and not against full scale.
/// Read the other way it is a floor, and a machine playing below that floor
/// never ducks at all. That is not an edge case: measured at a quarter of the
/// scale, which is an ordinary listening level, a setting of thirty percent
/// left the volume exactly where it was and the feature looked broken.
///
/// Clamped rather than trusted: the value comes back from a settings file that
/// a person can edit, and a percentage above a hundred would raise the volume
/// on somebody who asked for the opposite.
pub fn duck_level(current: f32, percent: u8) -> f32 {
    current.clamp(0.0, 1.0) * (percent.min(100) as f32) / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    // The endpoint calls need a sound card and a session, so they are not
    // exercised here. The arithmetic between the slider and the API is, since
    // that is where an off-by-one-hundred would be silent and loud.

    fn close(a: f32, b: f32) -> bool {
        (a - b).abs() < 1e-6
    }

    #[test]
    fn a_percentage_takes_that_share_of_the_current_level() {
        assert!(close(duck_level(1.0, 20), 0.2));
        assert!(close(duck_level(0.5, 20), 0.1));
        assert!(close(duck_level(0.5, 0), 0.0));
    }

    #[test]
    fn a_machine_already_quiet_still_gets_quieter() {
        // The level this was reported at: a quarter of the scale, with the
        // setting at thirty percent. Against full scale the target sat above
        // the current level and nothing moved at all.
        let before = 0.26;
        assert!(duck_level(before, 30) < before);
    }

    #[test]
    fn a_hundred_percent_leaves_the_volume_alone() {
        assert!(close(duck_level(0.4, 100), 0.4));
    }

    #[test]
    fn a_percentage_over_a_hundred_does_not_turn_the_volume_up() {
        assert!(close(duck_level(0.4, 255), 0.4));
    }
}
