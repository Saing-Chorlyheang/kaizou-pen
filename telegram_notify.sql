-- ============================================================
-- TELEGRAM ORDER NOTIFICATIONS
-- ------------------------------------------------------------
-- Sends a Telegram message when:
--   1. a new order is placed           (orders insert)
--   2. a payment screenshot is uploaded (payments insert)
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

-- ---------- 1. new order ----------
create or replace function public.notify_new_order()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  lines text;
  total integer := coalesce(new.subtotal, 0) + coalesce(new.shipping_fee, 0);
begin
  select string_agg(
           '• ' || tg_esc(i->>'name') || ' × ' || coalesce(i->>'qty', '1')
           || ' — $' || (coalesce((i->>'price')::numeric, 0) * coalesce((i->>'qty')::numeric, 1)),
           E'\n')
    into lines
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;

  perform tg_send('sendMessage', jsonb_build_object('text',
       '🛒 <b>New order</b>  #' || upper(left(new.id::text, 8)) || E'\n\n'
    || '👤 ' || tg_esc(new.customer_name) || E'\n'
    || '📞 ' || tg_esc(new.contact) || E'\n'
    || '📍 ' || tg_esc(new.address) || E'\n'
    || '🚚 ' || tg_esc(new.shipping_method) || E'\n\n'
    || coalesce(lines, '') || E'\n\n'
    || 'Subtotal $' || coalesce(new.subtotal, 0) || '  ·  Shipping $' || coalesce(new.shipping_fee, 0) || E'\n'
    || '<b>Total $' || total || '</b>'
    || case when coalesce(new.notes, '') <> '' then E'\n📝 ' || tg_esc(new.notes) else '' end
    || E'\n\n⏳ ' || replace(coalesce(new.status, 'pending'), '_', ' ')
  ));
  return new;
end $$;

drop trigger if exists telegram_new_order on public.orders;
create trigger telegram_new_order
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- ---------- 2. payment screenshot ----------
create or replace function public.notify_payment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = new.order_id;

  perform tg_send('sendPhoto', jsonb_build_object(
    'photo', new.screenshot_url,
    'caption',
         '💸 <b>Payment screenshot</b>  #' || upper(left(coalesce(new.order_id::text, '?'), 8)) || E'\n'
      || '👤 ' || tg_esc(o.customer_name) || E'\n'
      || '<b>Total $' || (coalesce(o.subtotal, 0) + coalesce(o.shipping_fee, 0)) || '</b>'
  ));
  return new;
end $$;

drop trigger if exists telegram_payment on public.payments;
create trigger telegram_payment
  after insert on public.payments
  for each row execute function public.notify_payment();

select 'telegram notify installed' as result;
