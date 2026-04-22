# ═══════════════════════════════════════════════════════════════════════════
# CINEPHILE TV - WINDOWS FRONTEND API FIXER
# ═══════════════════════════════════════════════════════════════════════════
# Run this in PowerShell to fix ALL your frontend files
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "🔧 FIXING ALL FRONTEND FILES..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Set your frontend directory
$frontendDir = "C:\Users\SUB-ZERO\Downloads\MY PROJECTS\Cinephile-Fullstack\frontend"

if (!(Test-Path $frontendDir)) {
    Write-Host "❌ ERROR: Frontend directory not found!" -ForegroundColor Red
    Write-Host "   Looking for: $frontendDir" -ForegroundColor Yellow
    exit
}

cd $frontendDir

# Find all relevant files
$files = Get-ChildItem -Path "app" -Include *.tsx,*.ts,*.jsx,*.js -Recurse

Write-Host "Found $($files.Count) files to check..." -ForegroundColor Yellow
Write-Host ""

$fixedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Replace localhost URLs
    if ($content -match '127\.0\.0\.1:8000|localhost:8000') {
        $content = $content -replace 'http://127\.0\.0\.1:8000', '${API_URL}'
        $content = $content -replace 'http://localhost:8000', '${API_URL}'
        $modified = $true
    }
    
    # Replace old const API declarations
    if ($content -match "const API = ['`"].*['`"];") {
        $content = $content -replace "const API = ['`"].*?['`"];", 'const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://cinephile-tv-production.up.railway.app";'
        $modified = $true
    }
    
    # Add API_URL if file uses fetch but doesn't have it
    if ($content -match 'fetch.*api' -and $content -notmatch 'API_URL') {
        # Find the last import line
        $lines = $content -split "`r?`n"
        $lastImportIndex = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^import ') {
                $lastImportIndex = $i
            }
        }
        
        if ($lastImportIndex -ge 0) {
            $lines = @(
                $lines[0..$lastImportIndex]
                ""
                'const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://cinephile-tv-production.up.railway.app";'
                $lines[($lastImportIndex+1)..($lines.Count-1)]
            )
            $content = $lines -join "`n"
            $modified = $true
        }
    }
    
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Fixed: $($file.Name)" -ForegroundColor Green
        $fixedCount++
    }
}

Write-Host ""
Write-Host "════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ DONE! Fixed $fixedCount files" -ForegroundColor Green
Write-Host "════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Commit and push to GitHub:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m `"fix: use Railway backend URL`"" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Vercel will auto-redeploy in 2-3 minutes" -ForegroundColor White
Write-Host ""
Write-Host "🎯 BACKEND:  https://cinephile-tv-production.up.railway.app" -ForegroundColor Cyan
Write-Host "🎯 FRONTEND: https://cinephile-tv.vercel.app" -ForegroundColor Cyan
Write-Host ""
