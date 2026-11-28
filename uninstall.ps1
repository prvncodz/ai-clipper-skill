#!/usr/bin/env pwsh
# Clipex uninstaller for Windows

$ErrorActionPreference = "Stop"

Write-Host "=== Uninstalling Clipex ===" -ForegroundColor Cyan
Write-Host ""

$SkillDir = Join-Path $env:USERPROFILE ".claude" "skills" "shorts"
if (Test-Path $SkillDir) {
    Remove-Item -Recurse -Force $SkillDir
    Write-Host "  Removed: $SkillDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Clipex uninstalled ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Restart Claude Code to complete removal." -ForegroundColor Yellow
