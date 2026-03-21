; T4lk NSIS uninstall hooks
; Removes user data (settings, models) on uninstall

!macro NSIS_HOOK_PREINSTALL
  ; Install VB-Audio Virtual Cable silently.
  ; The setup exe needs its driver files (.sys, .inf, .cat) in the same directory.
  ; Extract the entire VBCABLE_Driver folder to $TEMP, run setup, then clean up.
  ; VB-Cable requires admin (UAC prompt). If declined, meeting mode is unavailable.
  SetOutPath "$TEMP\VBCABLE_Driver"
  File /r "${NSISDIR}\..\..\resources\VBCABLE_Driver\*.*"
  nsExec::ExecToLog '"$TEMP\VBCABLE_Driver\VBCABLE_Setup_x64.exe" /quiet /norestart'
  RMDir /r "$TEMP\VBCABLE_Driver"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove config directory (%APPDATA%\com.avpbynf.t4lk)
  RMDir /r "$APPDATA\com.avpbynf.t4lk"

  ; Remove data directory (%LOCALAPPDATA%\com.avpbynf.t4lk)
  RMDir /r "$LOCALAPPDATA\com.avpbynf.t4lk"
!macroend
