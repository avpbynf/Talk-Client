; T4lk NSIS uninstall hooks
; Removes user data (settings, models) on uninstall

!macro NSIS_HOOK_PREINSTALL
  ; Install VB-Audio Virtual Cable silently.
  ; At PREINSTALL time $INSTDIR does not exist yet, so extract to $TEMP.
  ; VB-Cable requires admin (UAC prompt). If declined, meeting mode is unavailable.
  SetOutPath "$TEMP"
  File "${NSISDIR}\..\..\resources\VBCABLE_Setup_x64.exe"
  nsExec::ExecToLog '"$TEMP\VBCABLE_Setup_x64.exe" /quiet /norestart'
  Delete "$TEMP\VBCABLE_Setup_x64.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove config directory (%APPDATA%\com.avpbynf.t4lk)
  RMDir /r "$APPDATA\com.avpbynf.t4lk"

  ; Remove data directory (%LOCALAPPDATA%\com.avpbynf.t4lk)
  RMDir /r "$LOCALAPPDATA\com.avpbynf.t4lk"
!macroend
