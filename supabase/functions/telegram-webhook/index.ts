// ============================================================
// Telegram webhook — order status buttons
// ------------------------------------------------------------
// The paid-order message (telegram_notify.sql) carries 4 buttons.
// Tapping one calls this function, which updates orders.status
// (the same value the customer sees in "Track") and redraws the
// buttons to show progress.
// Env (set by telegram-webhook-setup.ps1):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ADMIN_IDS
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
// Channel buttons can be tapped by anyone who can see the channel — only these Telegram user ids may change a status
const ADMINS = new Set((Deno.env.get("TELEGRAM_ADMIN_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Same keys as STATUS_STEPS in script.js (customer tracking) and admin.js
const STEPS = [
  { key: "awaiting_payment", label: "💳 Payment sent" },
  { key: "confirmed", label: "✅ Confirmed" },
  { key: "shipped", label: "🚚 On the way" },
  { key: "delivered", label: "🎉 Delivered" },
];

// Keep in sync with the initial keyboard built in telegram_notify.sql
function keyboard(orderId: string, status: string) {
  const current = STEPS.findIndex((s) => s.key === status);
  const btn = (i: number) => ({
    text: (i < current ? "✓ " : i === current ? "▶ " : "") + STEPS[i].label,
    callback_data: `st:${orderId}:${STEPS[i].key}`,
  });
  return { inline_keyboard: [[btn(0), btn(1)], [btn(2), btn(3)]] };
}

const tg = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const ok = () => new Response("ok"); // always 200 so Telegram doesn't retry

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const cq = update?.callback_query;
  if (!cq) return ok();

  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cq.id, text });

  const m = /^st:([0-9a-f-]{36}):([a-z_]+)$/.exec(cq.data ?? "");
  const step = m && STEPS.find((s) => s.key === m[2]);
  if (!m || !step) { await answer("Unknown action"); return ok(); }
  if (!ADMINS.has(String(cq.from?.id))) { await answer("Only the shop admin can change the status."); return ok(); }

  const orderId = m[1];
  const { data, error } = await db.from("orders").update({ status: step.key }).eq("id", orderId).select("id");
  if (error || !data?.length) {
    await answer(error ? `Update failed: ${error.message}` : "Order not found (deleted?)");
    return ok();
  }

  await tg("editMessageReplyMarkup", {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    reply_markup: keyboard(orderId, step.key),
  });
  await answer(`Status → ${step.label}`);
  return ok();
});
