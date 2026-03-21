use thiserror::Error;

use super::detector::detect_vbcable;
use super::router::{AudioRouter, AudioRouterError};

#[derive(Error, Debug)]
pub enum VirtualMicError {
    #[error("VB-Cable is not installed")]
    VBCableNotInstalled,
    #[error("Router error: {0}")]
    Router(#[from] AudioRouterError),
}

/// High-level control API for the virtual mic routing.
pub struct VirtualMicController {
    router: Option<AudioRouter>,
}

impl VirtualMicController {
    pub fn new() -> Self {
        Self { router: None }
    }

    /// Enable meeting mode: start routing real mic -> VB-Cable.
    pub fn enable(&mut self) -> Result<(), VirtualMicError> {
        let status = detect_vbcable();
        if !status.installed {
            return Err(VirtualMicError::VBCableNotInstalled);
        }
        self.disable();
        let router = AudioRouter::start()?;
        self.router = Some(router);
        Ok(())
    }

    /// Disable meeting mode: stop routing.
    pub fn disable(&mut self) {
        if let Some(router) = self.router.take() {
            router.stop();
        }
    }

    /// Mute the virtual mic (write silence to VB-Cable).
    pub fn mute(&self) {
        if let Some(ref router) = self.router {
            router.mute();
        }
    }

    /// Unmute the virtual mic (resume forwarding real audio).
    pub fn unmute(&self) {
        if let Some(ref router) = self.router {
            router.unmute();
        }
    }

    /// Check if meeting mode is active.
    pub fn is_active(&self) -> bool {
        self.router.is_some()
    }

    /// Check if currently muted.
    pub fn is_muted(&self) -> bool {
        self.router
            .as_ref()
            .map(|r| r.is_muted())
            .unwrap_or(false)
    }
}

impl Default for VirtualMicController {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_controller_is_inactive() {
        let ctrl = VirtualMicController::new();
        assert!(!ctrl.is_active());
        assert!(!ctrl.is_muted());
    }

    #[test]
    fn disable_when_inactive_is_noop() {
        let mut ctrl = VirtualMicController::new();
        ctrl.disable();
        assert!(!ctrl.is_active());
    }

    #[test]
    fn mute_unmute_when_inactive_is_noop() {
        let ctrl = VirtualMicController::new();
        ctrl.mute();
        ctrl.unmute();
        assert!(!ctrl.is_muted());
    }
}
