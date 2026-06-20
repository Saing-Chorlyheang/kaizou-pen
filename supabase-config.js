// ============================================================
// SUPABASE CONFIG
// ------------------------------------------------------------
// 1. Go to https://supabase.com and create a free project.
// 2. In your project: Settings -> API
// 3. Copy "Project URL" and "anon public" key.
// 4. Paste them below, replacing the placeholders.
// 5. Save this file. Both index.html and admin.html will use it.
// ============================================================

const SUPABASE_URL  = "https://jscqbthvvzmxjqcfkssx.supabase.co/rest/v1/";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzY3FidGh2dnpteGpxY2Zrc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTAyMTksImV4cCI6MjA5NTM4NjIxOX0.mdYmqPBfcnsvK_N6VWrimzLHqJKdRTaVXoXVi4sJz2U";

// Normalize the URL — the Supabase JS client wants only the base
// (e.g. https://xxxxx.supabase.co), not "/rest/v1/" or trailing slashes.
const NORMALIZED_URL = SUPABASE_URL
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");

// `window.supabase` is the library namespace from the CDN.
// We create the client and expose it as `window.sb` to avoid clobbering it.
window.sb = window.supabase.createClient(NORMALIZED_URL, SUPABASE_ANON);

window.SUPABASE_CONFIGURED =
  !SUPABASE_URL.startsWith("PASTE_") && !SUPABASE_ANON.startsWith("PASTE_");

// ============================================================
// FACEBOOK PAGE (optional) — for routing orders to Messenger inbox
// ------------------------------------------------------------
// When set, after a customer places an order the site opens Messenger
// in a new tab with the order details pre-typed in the chat box.
// Customer taps Send → the order lands in your Facebook Business Suite
// inbox as a normal customer message.
//
// To find your Page username:
//   1. Open your Facebook Page
//   2. Look at the URL: facebook.com/YOUR_PAGE_USERNAME
//   3. Paste just the YOUR_PAGE_USERNAME part below (no slashes, no facebook.com)
//
// Leave empty string "" to disable the Messenger handoff (orders still save
// to Supabase normally).
// ============================================================
window.FB_PAGE_USERNAME = "";

// Optional shop name shown in the Messenger message header.
window.SHOP_NAME = "KAIZOU PEN";
