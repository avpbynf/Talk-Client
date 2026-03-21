; T4lk NSIS uninstall hooks
; Removes user data (settings, models) on uninstall

!macro NSIS_HOOK_PREINSTALL
  ; Install Virtual Audio Driver (open-source, MIT license).
  ; Extract driver files (.sys, .inf, .cat) to $TEMP, install via pnputil.
  ; Requires admin (UAC prompt). If declined, meeting mode is unavailable.
  SetOutPath "$TEMP\VirtualAudioDriver"
  File /r "${NSISDIR}\..\..\resources\VirtualAudioDriver\*.*"
  nsExec::ExecToLog 'pnputil /add-driver "$TEMP\VirtualAudioDriver\VirtualAudioDriver.inf" /install'
  RMDir /r "$TEMP\VirtualAudioDriver"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove config directory (%APPDATA%\com.avpbynf.t4lk)
  RMDir /r "$APPDATA\com.avpbynf.t4lk"

  ; Remove data directory (%LOCALAPPDATA%\com.avpbynf.t4lk)
  RMDir /r "$LOCALAPPDATA\com.avpbynf.t4lk"
!macroend
