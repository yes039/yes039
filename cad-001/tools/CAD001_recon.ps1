# ==========================================================================
# CAD001_recon.ps1  -  Phase 1 environment reconnaissance (READ-ONLY)
# --------------------------------------------------------------------------
# Run on the Windows PC that has AutoCAD, in a normal (non-admin) PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\CAD001_recon.ps1
# (-ExecutionPolicy Bypass applies to THIS process only; it does not change
#  the machine's policy.)
#
# What it does: reads Windows version, AutoCAD registry keys, COM ProgID
# registration, and tests whether a test folder is writable.
# What it does NOT do: start AutoCAD, change registry/security settings,
# install anything, or send data anywhere. Output is written to the screen
# and to CAD001_recon_result.txt next to this script.
# ==========================================================================
$ErrorActionPreference = "SilentlyContinue"
$out = Join-Path $PSScriptRoot "CAD001_recon_result.txt"
$lines = New-Object System.Collections.Generic.List[string]
function W($s) { $lines.Add($s); Write-Host $s }

W "CAD-001 recon  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "================================================================"

# 1. Windows
$os = Get-CimInstance Win32_OperatingSystem
W "[1] Windows : $($os.Caption)  version $($os.Version)  build $($os.BuildNumber)  $($os.OSArchitecture)"
W "    PowerShell $($PSVersionTable.PSVersion)"

# 2. AutoCAD installs (HKLM\SOFTWARE\Autodesk\AutoCAD\Rxx.x\ACAD-xxxx:yyy)
W "[2] AutoCAD installations (registry):"
$found = $false
Get-ChildItem "HKLM:\SOFTWARE\Autodesk\AutoCAD" | ForEach-Object {
  $rel = $_.PSChildName
  Get-ChildItem $_.PSPath | Where-Object { $_.PSChildName -like "ACAD-*" } | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath
    $loc = if ($p.AcadLocation) { $p.AcadLocation } else { $p.Location }
    $exe = if ($loc) { Join-Path $loc "acad.exe" } else { "" }
    $ver = if ($exe -and (Test-Path $exe)) { (Get-Item $exe).VersionInfo.ProductVersion } else { "acad.exe not found" }
    W "    $rel  $($_.PSChildName)  '$($p.ProductName)'"
    W "        path   : $loc"
    W "        acad.exe version : $ver"
    $found = $true
  }
}
if (-not $found) { W "    none found under HKLM\SOFTWARE\Autodesk\AutoCAD" }
W "    (R24.0=2021  R24.1=2022  R24.2=2023  R24.3=2024  R25.0=2025  R25.1=2026)"
W "    Product name containing 'LT' = AutoCAD LT (no ActiveX/vla-*)."

# 3. COM / ActiveX registration (needed for route B)
W "[3] COM ProgIDs:"
foreach ($id in @("AutoCAD.Application")) {
  $cur = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\$id\CurVer").'(default)'
  $clsid = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\$id\CLSID").'(default)'
  W "    $id  CurVer=$cur  CLSID=$clsid"
}
Get-ChildItem "Registry::HKEY_CLASSES_ROOT" -Name | Where-Object { $_ -like "AutoCAD.Application.*" } |
  ForEach-Object { W "    registered: $_" }

# 4. Test folder access
$test = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "CAD001_TEST"
W "[4] Test folder: $test"
if (-not (Test-Path $test)) { New-Item -ItemType Directory -Path $test | Out-Null; W "    created (empty test folder)" }
$probe = Join-Path $test "write_probe.txt"
"probe" | Out-File $probe
if (Test-Path $probe) { W "    write: OK"; Remove-Item $probe } else { W "    write: FAILED" }

# 5. Tools that matter for routes A/B/C
W "[5] Tools:"
foreach ($c in @("claude", "node", "python", "git")) {
  $cmd = Get-Command $c
  W ("    {0,-7}: {1}" -f $c, $(if ($cmd) { $cmd.Source } else { "not found" }))
}

W "================================================================"
W "Next: open AutoCAD, APPLOAD CAD001_ROOM.lsp, run CAD001_ENV and copy"
W "its output into the test record (SECURELOAD / TRUSTEDPATHS / LISPSYS)."
$lines | Out-File $out -Encoding utf8
Write-Host "saved: $out"
