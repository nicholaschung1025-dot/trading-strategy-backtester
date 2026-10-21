<#
.SYNOPSIS
  Install (or remove) a Windows scheduled task that starts Falcon Lab when
  you log in.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
  powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -Uninstall
#>
param(
  [switch]$Uninstall,
  [string]$TaskName = 'Falcon Lab',
  [string]$Port = '8765'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root 'server.py'

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "No scheduled task '$TaskName' found."
  }
  exit 0
}

if (-not (Test-Path $server)) { throw "server.py not found at $server" }

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw 'python was not found on PATH.' }

$action = New-ScheduledTaskAction -Execute $python -Argument "server.py" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed scheduled task '$TaskName'."
Write-Host "It starts 'python server.py' in $root at every log on."
Write-Host "Open http://127.0.0.1:$Port/index.html after the next log on."
Write-Host 'To remove it again: powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -Uninstall'
