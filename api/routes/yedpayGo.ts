import { Hono } from "hono";
import { log } from "../lib/logger";

export const yedpayGoRoutes = new Hono();

/** The referer/origin this tool simulates for Yedpay checkout. */
export const CHECKOUT_REFERER = "https://yedpay-test.kimi.pro";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Interstitial hop for opening a Yedpay checkout "with referer".
 *
 * Browsers cannot forge an arbitrary Referer on window.open — the referer is
 * always the page doing the navigation. So this page:
 *   1. server-side probes the checkout URL with Referer/Origin forced to
 *      CHECKOUT_REFERER, and reports whether Yedpay accepted it (200/302 vs 403)
 *   2. then auto-redirects to the checkout with referrer-policy "origin", so
 *      the Referer Yedpay sees is this console's own origin — exactly
 *      https://yedpay-test.kimi.pro/ once the console is published there.
 */
yedpayGoRoutes.get("/", async (c) => {
  const url = c.req.query("url") ?? "";

  // Only allow hopping to genuine Yedpay checkout pages.
  let target: URL | null = null;
  try {
    target = new URL(url);
  } catch {
    target = null;
  }
  const allowed =
    target &&
    target.protocol === "https:" &&
    (target.host === "api.yedpay.com" || target.host === "api-staging.yedpay.com") &&
    target.pathname.startsWith("/online-payment/checkout/");
  if (!allowed || !target) {
    return c.html(
      page({
        title: "Invalid checkout URL",
        body: `<p class="err">This hop only accepts Yedpay checkout URLs
          (https://api(-staging).yedpay.com/online-payment/checkout/…).</p>
          <p class="mono dim">${escapeHtml(url || "(empty)")}</p>`,
      }),
      400,
    );
  }

  // Probe with the simulated Referer/Origin.
  let probeStatus = 0;
  let probeNote = "";
  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        Referer: `${CHECKOUT_REFERER}/`,
        Origin: CHECKOUT_REFERER,
        "User-Agent":
          "Mozilla/5.0 (yedpay-console referer probe)",
      },
    });
    probeStatus = res.status;
    await res.arrayBuffer().catch(() => {}); // drain
  } catch (err) {
    probeNote = err instanceof Error ? err.message : String(err);
    log.warn("checkout referer probe failed", { error: probeNote });
  }

  const ok = probeStatus >= 200 && probeStatus < 400;
  const body = `
    <p class="dim">Opening checkout with Referer / Origin:</p>
    <p class="mono accent">${escapeHtml(CHECKOUT_REFERER)}</p>

    <div class="card">
      <div class="dim small">SERVER-SIDE PROBE (headers actually forced)</div>
      ${
        probeStatus
          ? `<div class="mono ${ok ? "ok" : "err"}">Yedpay → HTTP ${probeStatus} ${
              ok ? "✓ referer accepted" : "✗ referer rejected"
            }</div>`
          : `<div class="mono err">probe failed: ${escapeHtml(probeNote)}</div>`
      }
    </div>

    <p class="dim small">
      Redirecting in <span id="cd">2</span>s… The browser will send this console's
      own origin as Referer (<span class="mono">referrer-policy: origin</span>) —
      publish this console at <span class="mono accent">${escapeHtml(
        CHECKOUT_REFERER,
      )}</span> for an exact match.
    </p>
    <p>
      <a class="btn" href="${escapeHtml(target.toString())}">Open checkout now →</a>
      <a class="link" href="javascript:history.back()">Cancel</a>
    </p>
    <script>
      var s = 2, el = document.getElementById('cd');
      var t = setInterval(function () {
        s -= 1;
        if (s <= 0) { clearInterval(t); location.replace(${JSON.stringify(
          target.toString(),
        )}); return; }
        el.textContent = String(s);
      }, 1000);
    </script>`;

  return c.html(page({ title: "Opening checkout with referer…", body }));
});

function page({ title, body }: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="origin" />
<title>${escapeHtml(title)}</title>
<style>
  body { background:#070a09; color:#d7e3e8; font:14px/1.6 system-ui, sans-serif;
         display:flex; justify-content:center; padding:48px 16px; }
  main { max-width:640px; width:100%; }
  h1 { font-size:18px; margin:0 0 16px; }
  .mono { font-family:ui-monospace, Menlo, Consolas, monospace; word-break:break-all; }
  .dim { color:#4a5a64; }
  .small { font-size:12px; }
  .accent { color:#34d399; }
  .ok { color:#34d399; }
  .err { color:#f87171; }
  .card { border:1px solid #1f2a30; background:#0b100e; border-radius:8px;
          padding:12px 16px; margin:16px 0; }
  .btn { display:inline-block; background:#10b981; color:#06231a; font-weight:600;
         padding:12px 20px; border-radius:8px; text-decoration:none; margin-right:12px; }
  .link { color:#7d94a0; }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1>${body}</main></body>
</html>`;
}
