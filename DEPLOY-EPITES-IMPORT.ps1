Write-Host "Építési Napló import functions deploy" -ForegroundColor Cyan
Write-Host "Először verzió ellenőrzés..." -ForegroundColor Yellow
npx --yes supabase@latest --version
if ($LASTEXITCODE -ne 0) { Write-Host "Supabase CLI nem indult. Használd a GitHub Actions deployt." -ForegroundColor Red; Read-Host "Enter a kilépéshez"; exit 1 }

npx --yes supabase@latest functions deploy create-szakipiac-import --project-ref tcmihuwjlapfaonihdma --no-verify-jwt
npx --yes supabase@latest functions deploy claim-szakipiac-import --project-ref tcmihuwjlapfaonihdma --no-verify-jwt

Write-Host "Kész. Ellenőrizd Supabase-ben az Edge Functions listát." -ForegroundColor Green
Read-Host "Enter a bezáráshoz"
