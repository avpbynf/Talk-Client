; T4lk NSIS uninstall hooks
; Removes user data (settings, models) on uninstall

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove config directory (%APPDATA%\com.avpbynf.t4lk)
  RMDir /r "$APPDATA\com.avpbynf.t4lk"

  ; Remove data directory (%LOCALAPPDATA%\com.avpbynf.t4lk)
  RMDir /r "$LOCALAPPDATA\com.avpbynf.t4lk"
!macroend
