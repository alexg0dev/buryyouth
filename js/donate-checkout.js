(function () {
  const cfg = window.BYC_STRIPE || {};

  function $(id) {
    return document.getElementById(id);
  }

  function publishableKey() {
    const k = String(cfg.publishableKey || "").trim();
    if (!k || /^sk_/i.test(k)) return "";
    return k;
  }

  function showStatus(text, ok) {
    const el = $("checkout-status");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.className = ok ? "status" : "status status-err";
  }

  function endpointUrl() {
    const raw = String(cfg.checkoutEndpoint || "").trim().replace(/\/$/, "");
    if (!raw) return "";
    if (/\/create-checkout$/i.test(raw)) return raw;
    return raw + "/create-checkout";
  }

  function hasCheckoutApi() {
    return Boolean(endpointUrl());
  }

  function fallbackUrl(plan) {
    return plan === "monthly" ? cfg.subscribeLink : cfg.donateLink;
  }

  function paymentsReady(plan) {
    return hasCheckoutApi() || Boolean(fallbackUrl(plan));
  }

  function selectedPounds() {
    const custom = $("amount-custom");
    const typed = custom && custom.value !== "" ? Number(custom.value) : NaN;
    if (Number.isFinite(typed) && typed > 0) return typed;
    const on = document.querySelector(".amount-btn.is-on");
    return on ? Number(on.getAttribute("data-amount")) : 10;
  }

  // Apple Pay on the web is a card wallet. Detect device support so the
  // choice is honest; Checkout still needs the public domain verified.
  function deviceSupportsApplePay() {
    try {
      if (window.ApplePaySession && typeof ApplePaySession.canMakePayments === "function") {
        return ApplePaySession.canMakePayments();
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  async function paymentRequestSupportsApplePay() {
    if (!window.PaymentRequest) return false;
    try {
      const request = new PaymentRequest(
        [
          {
            supportedMethods: "https://apple.com/apple-pay",
            data: {
              version: 3,
              merchantIdentifier: "placeholder",
              merchantCapabilities: ["supports3DS"],
              supportedNetworks: ["visa", "masterCard", "amex"],
              countryCode: "GB",
            },
          },
        ],
        {
          total: { label: "Donate", amount: { currency: "GBP", value: "1.00" } },
        }
      );
      return (await request.canMakePayment()) === true;
    } catch (e) {
      return false;
    }
  }

  function applePayAvailableSync() {
    return deviceSupportsApplePay();
  }

  function selectedPaymentMethod() {
    const apple = $("pay-apple");
    if (apple && apple.classList.contains("is-on") && !apple.disabled) {
      return "apple_pay";
    }
    return "card";
  }

  function setPaymentMethod(method) {
    const card = $("pay-card");
    const apple = $("pay-apple");
    const wantApple = method === "apple_pay" && apple && !apple.disabled;
    if (card) {
      card.classList.toggle("is-on", !wantApple);
      card.setAttribute("aria-checked", wantApple ? "false" : "true");
    }
    if (apple) {
      apple.classList.toggle("is-on", Boolean(wantApple));
      apple.setAttribute("aria-checked", wantApple ? "true" : "false");
    }
  }

  function applyApplePayAvailability(available) {
    const apple = $("pay-apple");
    const note = $("pay-apple-note");
    if (!apple) return;
    apple.disabled = !available;
    apple.classList.toggle("is-unavailable", !available);
    apple.setAttribute("aria-disabled", available ? "false" : "true");
    if (available) {
      apple.removeAttribute("aria-describedby");
    } else {
      apple.setAttribute("aria-describedby", "pay-apple-note");
    }
    if (note) note.hidden = available;
    if (!available && apple.classList.contains("is-on")) {
      setPaymentMethod("card");
    }
  }

  function setPlan(plan) {
    const monthly = plan === "monthly";
    const oneoffBtn = $("plan-oneoff");
    const monthlyBtn = $("plan-monthly");
    const hint = $("plan-hint");
    const go = $("checkout-go");

    if (oneoffBtn) {
      oneoffBtn.classList.toggle("is-active", !monthly);
      oneoffBtn.setAttribute("aria-selected", monthly ? "false" : "true");
    }
    if (monthlyBtn) {
      monthlyBtn.classList.toggle("is-active", monthly);
      monthlyBtn.setAttribute("aria-selected", monthly ? "true" : "false");
    }
    if (hint) hint.textContent = monthly ? "Cancel anytime." : "A single gift.";
    if (go) go.textContent = monthly ? "Subscribe" : "Donate";

    const notice = $("checkout-setup-notice");
    const ready = paymentsReady(plan);
    if (notice) notice.hidden = ready;
    if (go) {
      go.disabled = !ready;
      go.classList.toggle("stripe-disabled", !ready);
    }

    const amountBlock = $("amount-block");
    if (amountBlock) amountBlock.hidden = !hasCheckoutApi() && Boolean(fallbackUrl(plan));
  }

  function currentPlan() {
    const monthlyBtn = $("plan-monthly");
    return monthlyBtn && monthlyBtn.classList.contains("is-active") ? "monthly" : "oneoff";
  }

  async function startCheckout() {
    const plan = currentPlan();
    const go = $("checkout-go");
    if (go) go.disabled = true;

    const api = endpointUrl();
    if (!api) {
      const link = fallbackUrl(plan);
      if (link) {
        window.location.href = link;
        return;
      }
      showStatus("Donations aren't available yet.", false);
      if (go) go.disabled = false;
      return;
    }

    const amount = selectedPounds();
    if (!Number.isFinite(amount) || amount < 1) {
      showStatus("Enter an amount.", false);
      if (go) go.disabled = false;
      return;
    }

    const paymentMethod = selectedPaymentMethod();
    if (paymentMethod === "apple_pay" && !applePayAvailableSync()) {
      showStatus("Not available on this device.", false);
      setPaymentMethod("card");
      if (go) go.disabled = false;
      return;
    }

    showStatus("Continuing…", true);

    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: plan === "monthly" ? "subscription" : "payment",
          amount: amount,
          origin: window.location.origin,
          paymentMethod: paymentMethod,
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.id && window.Stripe && publishableKey()) {
        const stripe = window.Stripe(publishableKey());
        const result = await stripe.redirectToCheckout({ sessionId: data.id });
        if (result && result.error) {
          showStatus("Couldn't start payment. Try again.", false);
          if (go) go.disabled = false;
        }
        return;
      }

      showStatus("Couldn't start payment. Try again.", false);
    } catch (e) {
      showStatus("Couldn't start payment. Try again.", false);
    }
    if (go) go.disabled = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "cancelled") {
      const cancelled = $("checkout-cancelled");
      if (cancelled) cancelled.hidden = false;
    }

    const initial = params.get("plan") === "monthly" ? "monthly" : "oneoff";
    setPlan(initial);

    applyApplePayAvailability(applePayAvailableSync());
    paymentRequestSupportsApplePay().then(function (ok) {
      if (ok) applyApplePayAvailability(true);
    });

    const oneoffBtn = $("plan-oneoff");
    const monthlyBtn = $("plan-monthly");
    if (oneoffBtn) {
      oneoffBtn.addEventListener("click", function () {
        setPlan("oneoff");
      });
    }
    if (monthlyBtn) {
      monthlyBtn.addEventListener("click", function () {
        setPlan("monthly");
      });
    }

    document.querySelectorAll(".amount-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".amount-btn").forEach(function (b) {
          b.classList.remove("is-on");
        });
        btn.classList.add("is-on");
        const custom = $("amount-custom");
        if (custom) custom.value = "";
      });
    });

    const custom = $("amount-custom");
    if (custom) {
      custom.addEventListener("input", function () {
        if (custom.value === "") return;
        document.querySelectorAll(".amount-btn").forEach(function (b) {
          b.classList.remove("is-on");
        });
      });
    }

    const card = $("pay-card");
    const apple = $("pay-apple");
    if (card) {
      card.addEventListener("click", function () {
        setPaymentMethod("card");
      });
    }
    if (apple) {
      apple.addEventListener("click", function () {
        if (apple.disabled) return;
        setPaymentMethod("apple_pay");
      });
    }

    const methodRow = document.querySelector(".pay-method-row");
    if (methodRow) {
      methodRow.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") {
          return;
        }
        e.preventDefault();
        const current = selectedPaymentMethod();
        const next = current === "card" && apple && !apple.disabled ? "apple_pay" : "card";
        setPaymentMethod(next);
        const focusEl = next === "apple_pay" ? apple : card;
        if (focusEl) focusEl.focus();
      });
    }

    const go = $("checkout-go");
    if (go) go.addEventListener("click", startCheckout);
  });
})();
