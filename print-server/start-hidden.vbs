' Le Vantage Print Proxy - Hidden Background Launcher
' Runs the print proxy completely invisible (no window, no taskbar icon)
' To stop: Open Task Manager > find "node.exe" > End Task

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the folder this script is in
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Auto-update index.js from GitHub (silent)
On Error Resume Next
WshShell.Run "powershell -WindowStyle Hidden -Command ""[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js' -OutFile '" & scriptDir & "\index.js' -ErrorAction Stop } catch {}""", 0, True
On Error GoTo 0

' Install dependencies if needed
If Not fso.FolderExists(scriptDir & "\node_modules") Then
    WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm install", 0, True
End If

' Run the print proxy completely hidden (window style 0 = hidden)
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node index.js", 0, False
