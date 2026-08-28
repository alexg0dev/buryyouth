# Save Our Youth

Public site: [saveburyyouth.com](https://saveburyyouth.com)

**Handled by Member of Youth Parliament Alexandro Ghanem** · [ghanem.uk](https://ghanem.uk)

Not associated with NYA or Bury Council.

## Stack

HTML · CSS · vanilla JS · optional [Supabase](https://supabase.com) · Railway checkout API

## Donations (Railway)

Checkout Sessions are created by a small Node server (`server/index.js`). The secret key must never live in the repo.

1. **Rotate** any payment secret that was pasted in chat. Use the new secret only.
2. Deploy this repo on [Railway](https://railway.app) (start command `npm start`).
3. In Railway **Variables**, set:
   - `STRIPE_SECRET_KEY` — the **new** rotated secret (see `.env.example`; leave the example empty)
   - `SITE_URL` — `https://saveburyyouth.com`
4. Put the Railway URL in `js/config.js` → `BYC_STRIPE.checkoutEndpoint`  
   (e.g. `https://your-service.up.railway.app/create-checkout`).
5. Optional fallback: Payment Link URLs in `donateLink` / `subscribeLink` if the API is not deployed yet.
6. **Apple Pay:** verify the public domain in the payments dashboard (Settings → Payment methods → Apple Pay). Same step if you use Payment Links.

Local API: copy `.env.example` to `.env` (gitignored), set the rotated secret there, `npm start`.

The publishable key in `js/config.js` is safe for the browser. Never add `sk_live` to any project file.

## Accounts

Project `a.lex myp` (`lvcpschhawfbylitoxqc`) is **INACTIVE**. Restore and create both failed:

> alexg0dev has reached their maximum limits for the number of active free projects (2 project limit). Delete, pause, or upgrade one of those projects first.

Then:

1. Restore `a.lex myp` (or create `saveburyyouth`) and wait until it is ACTIVE.
2. Run `supabase/schema.sql` in the SQL editor.
3. Paste the **publishable / anon** key into `js/config.js` (`anonKey`). The project URL is already set. Never put a service-role key in the client.
4. **Authentication → Providers → Email:** Confirm email **ON**.
5. **Authentication → URL Configuration:**
   - Site URL: `https://saveburyyouth.com`
   - Redirect URLs: `https://saveburyyouth.com/login.html`, `https://saveburyyouth.com/**`, `http://localhost:*/login.html`, `http://127.0.0.1:*/login.html`
6. Built-in confirmation email is enough for light use. Add custom SMTP under Authentication → Emails if messages are delayed.

Until `anonKey` is filled, the login page shows that accounts are not ready and the rest of the site uses browser `localStorage`.

## Admin

Open `admin.html` (password in `js/store.js`).

## Poll

Default question: **What should be prioritised for Bury's youth?**
