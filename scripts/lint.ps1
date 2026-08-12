param (
    [switch]$Fix,
    [alias("v")][switch]$VerboseOutput
)

$scriptPath = Join-Path $PSScriptRoot "lint.py"
$params = @()
if ($Fix) { $params += "--fix" }
if ($VerboseOutput) { $params += "-v" }

python $scriptPath @params
