; Talk NSIS uninstall hooks
; Removes user data (settings, models) on uninstall

!macro NSIS_HOOK_PREINSTALL
  ; Install VB-Audio Virtual Cable silently, when its payload is vendored.
  ; The setup exe needs its driver files (.sys, .inf, .cat) in the same directory,
  ; so extract the whole VBCABLE_Driver folder to $TEMP, run setup, then clean up.
  ; VB-Cable requires admin (UAC prompt). If declined, meeting mode is unavailable.
  ;
  ; The payload is not in the repository: it is redistributed by VB-Audio under its
  ; own terms, so fetch it from vb-audio.com and unpack it into
  ; src-tauri/resources/VBCABLE_Driver/ to build an installer that sets it up.
  ; Without it the app still runs and still detects VB-Cable at startup; only the
  ; automatic install goes away, and meeting mode asks for the driver instead.
!if /FileExists "${NSISDIR}\..\..\resources\VBCABLE_Driver\VBCABLE_Setup_x64.exe"
  SetOutPath "$TEMP\VBCABLE_Driver"
  File /r "${NSISDIR}\..\..\resources\VBCABLE_Driver\*.*"
  nsExec::ExecToLog '"$TEMP\VBCABLE_Driver\VBCABLE_Setup_x64.exe" /quiet /norestart'
  RMDir /r "$TEMP\VBCABLE_Driver"
!else
  DetailPrint "VB-Cable payload not bundled; meeting mode needs the driver installed by hand."
!endif
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove config directory (%APPDATA%\com.avpbynf.t4lk)
  RMDir /r "$APPDATA\com.avpbynf.t4lk"

  ; Remove data directory (%LOCALAPPDATA%\com.avpbynf.t4lk)
  RMDir /r "$LOCALAPPDATA\com.avpbynf.t4lk"
!macroend
