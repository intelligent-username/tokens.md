$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = 'tmd'
  fileType       = 'exe'
  url64bit       = 'https://github.com/intelligent-username/tokens.md/releases/download/v0.0.12/tmd-windows-x64.exe'
  checksum64     = 'ae2b88cae213c22b47aafccf045b62b79290e14ecac501156a46cbc72162e8f2'
  checksumType64 = 'sha256'
  silentArgs     = ''
  validExitCodes = @(0)
}

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dest = Join-Path $toolsDir 'tmd.exe'

Get-ChocolateyWebFile @packageArgs -FileFullPath $dest
