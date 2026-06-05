# Executa todos os casos de teste (CT-01..CT-10) em sequência.
#
# Uso:
#   .\run-all.ps1                      # alvo = réplica local (http://localhost:3000)
#   .\run-all.ps1 -BaseUrl https://jsonplaceholder.typicode.com   # alvo público
#   .\run-all.ps1 -NoInflux            # sem enviar métricas ao InfluxDB
#
# Pré-requisitos: k6 instalado e (para o dashboard) `docker compose up -d`.
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$InfluxUrl = "http://localhost:8086/k6",
    [switch]$NoInflux
)

$ErrorActionPreference = "Stop"
$tests = Get-ChildItem -Path "$PSScriptRoot\tests" -Filter "ct*.js" | Sort-Object Name
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\results" | Out-Null

foreach ($test in $tests) {
    $testid = $test.BaseName.Substring(0, 4)   # ex.: "ct01"
    Write-Host "`n=== Executando $($test.Name)  (testid=$testid, alvo=$BaseUrl) ===" -ForegroundColor Cyan

    $args = @(
        "run",
        "-e", "BASE_URL=$BaseUrl",
        "--tag", "testid=$testid",
        "--summary-export", "$PSScriptRoot\results\$testid.json"
    )
    if (-not $NoInflux) {
        $args += @("--out", "influxdb=$InfluxUrl")
    }
    $args += "$PSScriptRoot\tests\$($test.Name)"

    & k6 @args
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  -> $testid FALHOU em algum threshold (exit $LASTEXITCODE)" -ForegroundColor Yellow
    }
}

Write-Host "`nConcluído. Resumos em .\results\  | Dashboard: http://localhost:3001" -ForegroundColor Green
