!macro customInit
  nsExec::Exec "taskkill /F /IM Polaryon.exe"
  Sleep 2000
  nsExec::Exec "taskkill /F /IM Polaryon.exe"
  Sleep 1000
!macroend
