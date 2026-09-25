-- ============================================================
-- TELEGRAM ORDER NOTIFICATIONS
-- ------------------------------------------------------------
-- Sends ONE Telegram message per paid order: when the customer uploads the
-- payment screenshot (payments insert), the screenshot is posted with the
-- full order details as its caption. Unpaid orders are not announced.
-- The bot token and chat id live in Supabase Vault as
-- 'telegram_bot_token' / 'telegram_chat_id' (set by telegram-setup.ps1).
-- Sending is async (pg_net) and never blocks or fails an order.
-- Safe to re-run.
-- ============================================================

create extension if not exists pg_net;

-- HTML-escape customer text for Telegram's parse_mode=HTML
create or replace function public.tg_esc(t text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function public.tg_send(method text, payload jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  tok  text;
  chat text;
begin
  select decrypted_secret into tok  from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into chat from vault.decrypted_secrets where name = 'telegram_chat_id';
  if tok is null or chat is null then return; end if;

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || tok || '/' || method,
    body    := payload || jsonb_build_object('chat_id', chat, 'parse_mode', 'HTML'),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'telegram notify failed: %', sqlerrm;
end $$;

-- Must not be callable from the site (anon) — otherwise anyone could spam the chat via RPC
revoke all on function public.tg_send(text, jsonb) from public, anon, authenticated;

-- No message when the order form is submitted — only once the customer
-- has actually paid (uploaded the screenshot). Removes the old trigger.
drop trigger if exists telegram_new_order on public.orders;
drop function if exists public.notify_new_order();

-- ---------- paid order: details + payment screenshot in ONE message ----------
create or replace function public.notify_payment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  o     public.orders;
  lines text;
  head  text;
  info  text;
  notes text := '';
  room  integer;
begin
  select * into o from public.orders where id = new.order_id;

  select string_agg(
           '• ' || tg_esc(i->>'name') || ' × ' || coalesce(i->>'qty', '1')
           || ' — $' || (coalesce((i->>'price')::numeric, 0) * coalesce((i->>'qty')::numeric, 1)),
           E'\n')
    into lines
    from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i;

  -- Layout: header / items / total / customer / notes
  head := '✅ <b>Paid order</b>  #' || upper(left(coalesce(new.order_id::text, '?'), 8)) || E'\n\n';
  lines := coalesce(lines, '');
  info := E'\n\n<b>Total $' || (coalesce(o.subtotal, 0) + coalesce(o.shipping_fee, 0)) || '</b>'
       || '  (items $' || coalesce(o.subtotal, 0) || ' + shipping $' || coalesce(o.shipping_fee, 0) || ')' || E'\n\n'
       || '👤 ' || tg_esc(o.customer_name) || E'\n'
       || '📞 ' || tg_esc(o.contact) || E'\n'
       || '📍 ' || tg_esc(o.address) || E'\n'
       || '🚚 ' || tg_esc(o.shipping_method);
  if coalesce(o.notes, '') <> '' then notes := E'\n\n📝 ' || tg_esc(o.notes); end if;

  -- Telegram photo captions max out at 1024 chars (tags count). Trim notes
  -- first, then the item list — never the total or the customer's contact info.
  room := 1024 - char_length(head) - char_length(info) - 7;          -- 7 = <b></b>
  if char_length(lines) + char_length(notes) > room then
    notes := case when room - char_length(lines) > 20
                  then regexp_replace(left(notes, room - char_length(lines) - 2), '&[#a-z0-9]*$', '') || ' …'
                  else '' end;
    if char_length(lines) > room then
      lines := regexp_replace(left(lines, room - 2), '&[#a-z0-9]*$', '') || ' …';
    end if;
  end if;

  -- Status buttons (handled by supabase/functions/telegram-webhook; keep labels in sync)
  perform tg_send('sendPhoto', jsonb_build_object('photo', new.screenshot_url,
    'caption', head || '<b>' || lines || '</b>' || info || notes,
    'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(
      jsonb_build_array(
        jsonb_build_object('text', '▶ 💳 Payment sent', 'callback_data', 'st:' || new.order_id || ':awaiting_payment'),
        jsonb_build_object('text', '✅ Confirmed',       'callback_data', 'st:' || new.order_id || ':confirmed')),
      jsonb_build_array(
        jsonb_build_object('text', '🚚 On the way',      'callback_data', 'st:' || new.order_id || ':shipped'),
        jsonb_build_object('text', '🎉 Delivered',       'callback_data', 'st:' || new.order_id || ':delivered'))
    ))));
  return new;
end $$;

drop trigger if exists telegram_payment on public.payments;
create trigger telegram_payment
  after insert on public.payments
  for each row execute function public.notify_payment();

select 'telegram notify installed' as result;
