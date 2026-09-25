# ============================================================
# Telegram order notifications — one-time setup
# ------------------------------------------------------------
# Before running:
#   1. Create a bot with @BotFather in Telegram and copy its token.
#   2. Press Start in the bot chat. For a group/channel: add the bot (as admin
#      for a channel) and post one message there — the latest chat is used.
#   3. Save the token (never paste it in chat):
#        [Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "123:ABC...", "User")
# Then run:  powershell -ExecutionPolicy Bypass -File .\telegram-setup.ps1
# After editing telegram_notify.sql, apply only the SQL (keeps the saved chat):
#   powershell -ExecutionPolicy Bypass -File .\telegram-setup.ps1 -SqlOnly
#
# What it does: finds your chat id, stores token + chat id in Supabase Vault,
# installs telegram_notify.sql (triggers), and sends a test message.
# Uses SUPABASE_ACCESS_TOKEN (already set) for the Supabase Management API.
# ============================================================
param([switch]$SqlOnly)
$ErrorActionPreference = "Stop"
$ProjectRef = "jscqbthvvzmxjqcfkssx"

$sb = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "User")
if (-not $sb) { throw "SUPABASE_ACCESS_TOKEN is not set." }

function Invoke-Sql($sql) {
  $body = @{ query = $sql } | ConvertTo-Json -Compress
  # PowerShell 5.1 would send the body as Latin-1 and break the emoji in the SQL
  Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -Headers @{ Authorization = "Bearer $sb" } -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
}

function Install-Triggers {
  # ReadAllText, not Get-Content: in PS 5.1 Get-Content's string carries PSPath etc. and ConvertTo-Json emits an object
  Invoke-Sql ([IO.File]::ReadAllText((Join-Path $PSScriptRoot "telegram_notify.sql"), [Text.Encoding]::UTF8))
  Write-Host "Triggers installed."
}

if ($SqlOnly) { Install-Triggers; return }

$bot = [Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "User")
if (-not $bot) { throw "TELEGRAM_BOT_TOKEN is not set (see the top of this file)." }
if ($bot -notmatch '^\d+:[A-Za-z0-9_-]+$') { throw "TELEGRAM_BOT_TOKEN does not look like a bot token." }

# ---- 1. chat id: from TELEGRAM_CHAT_ID, or the latest chat that messaged the bot ----
$chat = [Environment]::GetEnvironmentVariable("TELEGRAM_CHAT_ID", "User")
if (-not $chat) {
  $wh = (Invoke-RestMethod "https://api.telegram.org/bot$bot/getWebhookInfo").result.url
  if ($wh) { throw "The status-button webhook is active, so the chat can't be auto-detected. Set TELEGRAM_CHAT_ID, or use -SqlOnly." }
  $updates = Invoke-RestMethod "https://api.telegram.org/bot$bot/getUpdates"
  # private chat / group → message, channel → channel_post, bot added somewhere → my_chat_member
  $chats = @($updates.result | ForEach-Object {
    foreach ($k in 'message', 'channel_post', 'my_chat_member') { if ($_.$k) { $_.$k.chat; break } }
  } | Where-Object { $_ })
  if ($chats.Count -eq 0) { throw "No messages found. Send any message to your bot in Telegram, then run this again." }
  $c = $chats[-1]
  $chat = [string]$c.id
  $label = if ($c.title) { $c.title } else { "$($c.first_name) $($c.last_name)".Trim() }
  Write-Host "Chat found: $label ($($c.type), id $chat)"
}
if ($chat -notmatch '^-?\d+$') { throw "Chat id '$chat' is not numeric." }

# ---- 2. store secrets in Vault + install triggers ----
$vaultSql = @"
do `$`$
declare s record;
begin
  for s in select * from (values ('telegram_bot_token', '$bot'), ('telegram_chat_id', '$chat')) v(name, val) loop
    if exists (select 1 from vault.secrets where name = s.name) then
      perform vault.update_secret((select id from vault.secrets where name = s.name), s.val);
    else
      perform vault.create_secret(s.val, s.name);
    end if;
  end loop;
end `$`$;
"@
Invoke-Sql $vaultSql
Write-Host "Secrets saved to Supabase Vault."

Install-Triggers

# ---- 3. test message ----
$check = [char]::ConvertFromUtf32(0x2705)   # this file is read as ANSI by PowerShell 5.1, so no literal emoji
$msg = @{ chat_id = $chat; text = "$check Kaizou Pen: order notifications are connected." } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$bot/sendMessage" `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($msg)) | Out-Null
Write-Host "Test message sent. Check Telegram."
