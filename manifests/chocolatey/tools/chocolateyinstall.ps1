$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = 'tmd'
  fileType       = 'exe'
  url64bit       = 'https://github.com/intelligent-username/tokens.md/releases/download/v0.0.5/tmd-windows-x64.exe'
  checksum64     = 'REPLACE_WITH_SHA256_WINDOWS_X64'
  checksumType64 = 'sha256'
  silentArgs     = ''
  validExitCodes = @(0)
}

# The binary is a self-contained executable; copy it to the tools dir so
# Chocolatey adds it to PATH via shimgen.
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dest = Join-Path $toolsDir 'tmd.exe'

Get-ChocolateyWebFile @packageArgs -FileFullPath $dest
