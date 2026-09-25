# ============================================================
# Telegram status buttons — one-time setup
# ------------------------------------------------------------
# Deploys supabase/functions/telegram-webhook and points the bot at it,
# so the 4 buttons under each paid-order message update the order status.
# Needs TELEGRAM_BOT_TOKEN + SUPABASE_ACCESS_TOKEN (already set) and Node (npx).
# Run:  powershell -ExecutionPolicy Bypass -File .\telegram-webhook-setup.ps1
#
# -AdminIds: Telegram user ids allowed to change a status (comma separated).
# Note: while the webhook is set, telegram-setup.ps1 cannot auto-detect a chat
# (Telegram disables getUpdates); use its -SqlOnly mode, or set TELEGRAM_CHAT_ID.
# ============================================================
param([string]$AdminIds = "1009754777")
$ErrorActionPreference = "Stop"
$ProjectRef = "jscqbthvvzmxjqcfkssx"

$bot = [Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "User")
$sb  = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "User")
if (-not $bot) { throw "TELEGRAM_BOT_TOKEN is not set." }
if (-not $sb)  { throw "SUPABASE_ACCESS_TOKEN is not set." }
if ($AdminIds -notmatch '^\d+(,\d+)*$') { throw "-AdminIds must be numeric Telegram user ids, comma separated." }

# ---- 1. function secrets (Management API) ----
$hookSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$secrets = @(
  @{ name = "TELEGRAM_BOT_TOKEN";      value = $bot },
  @{ name = "TELEGRAM_WEBHOOK_SECRET"; value = $hookSecret },
  @{ name = "TELEGRAM_ADMIN_IDS";      value = $AdminIds }
) | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ProjectRef/secrets" `
  -Headers @{ Authorization = "Bearer $sb" } -ContentType "application/json" -Body $secrets | Out-Null
Write-Host "Function secrets saved."

# ---- 2. deploy the function (no Docker needed with --use-api) ----
$env:SUPABASE_ACCESS_TOKEN = $sb
Push-Location $PSScriptRoot
try {
  & npx --yes supabase@latest functions deploy telegram-webhook --project-ref $ProjectRef --no-verify-jwt --use-api
  if ($LASTEXITCODE -ne 0) { throw "Function deploy failed (exit $LASTEXITCODE)." }
} finally { Pop-Location }
Write-Host "Function deployed."

# ---- 3. point the bot at the function ----
$hook = @{
  url                  = "https://$ProjectRef.supabase.co/functions/v1/telegram-webhook"
  secret_token         = $hookSecret
  allowed_updates      = @("callback_query")
  drop_pending_updates = $true
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$bot/setWebhook" -ContentType "application/json" -Body $hook | Out-Null
$info = (Invoke-RestMethod "https://api.telegram.org/bot$bot/getWebhookInfo").result
Write-Host "Webhook set: $($info.url)"

# ---- 4. re-install the SQL so new paid-order messages carry the buttons ----
& (Join-Path $PSScriptRoot "telegram-setup.ps1") -SqlOnly
Write-Host "Done. New paid orders will show the status buttons."
