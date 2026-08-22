$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = 'tmd'
  fileType       = 'exe'
  url64bit       = 'https://github.com/intelligent-username/tokens.md/releases/download/v0.0.18/tmd-windows-x64.exe'
  checksum64     = 'e611517b030eb0e2a3d03e802d818f53643e4569683f0a39900e2c8efbdbea36'
  checksumType64 = 'sha256'
  silentArgs     = ''
  validExitCodes = @(0)
}

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dest = Join-Path $toolsDir 'tmd.exe'

Get-ChocolateyWebFile @packageArgs -FileFullPath $dest
