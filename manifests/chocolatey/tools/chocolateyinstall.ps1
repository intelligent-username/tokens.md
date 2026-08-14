$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = 'tmd'
  fileType       = 'exe'
  url64bit       = 'https://github.com/intelligent-username/tokens.md/releases/download/v0.0.14/tmd-windows-x64.exe'
  checksum64     = '5a8e1e1989973ea26bd9ad1b0a352a13ba5b76efd9a3bac4ef8b9aad4e26b276'
  checksumType64 = 'sha256'
  silentArgs     = ''
  validExitCodes = @(0)
}

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dest = Join-Path $toolsDir 'tmd.exe'

Get-ChocolateyWebFile @packageArgs -FileFullPath $dest
