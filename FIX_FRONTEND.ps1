Write-Host "FIXING FRONTEND FILES..."

$frontendDir = "C:\Users\SUB-ZERO\Downloads\MY PROJECTS\Cinephile-Fullstack\frontend"

if (!(Test-Path $frontendDir)) {
    Write-Host "ERROR: Frontend directory not found!"
    exit
}

Set-Location $frontendDir

$files = Get-ChildItem -Path "app" -Include *.tsx,*.ts,*.js,*.jsx -Recurse

Write-Host "Found $($files.Count) files"

foreach ($file in $files) {

    $content = Get-Content -LiteralPath $file.FullName | Out-String
    $modified = $false

    # Replace localhost URLs
    if ($content -match "localhost:8000|127\.0\.0\.1:8000") {
        $content = $content -replace "http://localhost:8000", '${API_URL}'
        $content = $content -replace "http://127.0.0.1:8000", '${API_URL}'
        $modified = $true
    }

    # Add API_URL if missing
    if ($content -match "fetch" -and $content -notmatch "API_URL") {
        $apiLine = 'const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://cinephile-tv-production.up.railway.app";'
        $content = $apiLine + "`r`n" + $content
        $modified = $true
    }

    if ($modified) {
        Set-Content -LiteralPath $file.FullName -Value $content
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host ""
Write-Host "DONE"
Write-Host ""
Write-Host "Run next:"
Write-Host "git add ."
Write-Host "git commit -m `"fix: API URL`""
Write-Host "git pull origin main --rebase"
Write-Host "git push"