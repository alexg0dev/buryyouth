// Auth backend (developer only). Project URL + anon/publishable key.
// Never put a service-role or secret key in this file. Use HTTPS in production.
//
// Auth Dashboard — Authentication → Providers → Email:
//   Confirm email = ON (required).
// Authentication → URL Configuration:
//   Site URL: https://saveburyyouth.com
//   Redirect URLs:
//     https://saveburyyouth.com/login.html
//     https://saveburyyouth.com/**
//     http://localhost:*/login.html
//     http://127.0.0.1:*/login.html
// Built-in confirmation email works for light use. Add custom SMTP in
// Authentication → Emails if messages are delayed or rate-limited.
window.BYC_SUPABASE = {
  url: "https://rfnxiaaewhhtjpwwxibd.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbnhpYWFld2hodGpwd3d4aWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDY2NjMsImV4cCI6MjEwMzQ4MjY2M30.P_hnrAxgY2lQTzGpTh3ptsecSan7oqP0sj7pPzcaAhI",
};

// Railway public URL (no trailing slash), e.g. https://your-service.up.railway.app
// Used for POST /cast-vote. If empty, the checkoutEndpoint host is reused.
window.BYC_API = {
  apiBase: "",
};

// Payments (developer only — never put a secret / sk_live key in this file).
//
// 1. Set STRIPE_SECRET_KEY in Railway Variables only (see .env.example).
//    Rotate any secret that was pasted in chat. Not here.
// 2. Deploy server/index.js on Railway (`npm start`). Put that public service
//    URL in checkoutEndpoint (include /create-checkout).
// 3. Apple Pay: verify the public site domain in the payments dashboard
//    (Settings → Payment methods → Apple Pay / Payment method domains).
//    Checkout still uses payment_method_types: card; Apple Pay is a wallet.
//    The checkout page sends paymentMethod: "card" | "apple_pay".
//
// Fallback: if checkoutEndpoint is empty, Donate/Subscribe on the checkout
// page can still open donateLink / subscribeLink (Payment Links).
window.BYC_STRIPE = {
  publishableKey:
    "pk_live_51U9L0TCWWMAYB6cxzJv99LkqGjrw6TXEmjFLyt4qx7Mi5mjNTNWBMZKbeGUjmABcOH1Fgvcaxl47LOlGh76mNmWg00QHA1npW4",
  checkoutEndpoint: "",
  donateLink: "",
  subscribeLink: "",
  customerPortal: "",
};
