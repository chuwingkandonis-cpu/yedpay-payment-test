import crypto from "node:crypto";

export type YedpayEnvironment = "production" | "staging";

const BASE_URLS: Record<YedpayEnvironment, string> = {
  production: "https://api.yedpay.com/v1",
  staging: "https://api-staging.yedpay.com/v1",
};

export interface YedpayCredentials {
  apiKey: string;
  signKey: string;
  environment: YedpayEnvironment;
}

export function getCredentials(): YedpayCredentials {
  return {
    apiKey: process.env.YEDPAY_API_KEY ?? "",
    signKey: process.env.YEDPAY_SIGN_KEY ?? "",
    environment:
      process.env.YEDPAY_ENV === "staging" ? "staging" : "production",
  };
}

export function baseUrl(environment: YedpayEnvironment): string {
  return BASE_URLS[environment];
}

export interface YedpayCallResult {
  ok: boolean;
  httpStatus: number;
  url: string;
  method: string;
  requestBody: string;
  responseText: string;
  responseJson: unknown;
  durationMs: number;
}

/**
 * Fire a signed-API-key request against the Yedpay REST API.
 * All merchant-API calls use header `Authorization: API-KEY <key>` and
 * `application/x-www-form-urlencoded` bodies per the official docs.
 */
export async function callYedpay(opts: {
  environment: YedpayEnvironment;
  apiKey: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // e.g. "/online-payment" — absolute http(s) URLs also allowed
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Promise<YedpayCallResult> {
  const base = opts.path.startsWith("http")
    ? opts.path
    : `${BASE_URLS[opts.environment]}${opts.path}`;

  const url = new URL(base);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const bodyParams = Object.entries(opts.params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  const requestBody = new URLSearchParams(bodyParams).toString();

  const started = Date.now();
  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      Authorization: `API-KEY ${opts.apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body:
      opts.method === "GET" || opts.method === "DELETE" || !requestBody
        ? undefined
        : requestBody,
  });
  const responseText = await res.text();
  let responseJson: unknown = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    // non-JSON response (e.g. HTML error page) — keep raw text
  }
  return {
    ok: res.ok,
    httpStatus: res.status,
    url: url.toString(),
    method: opts.method,
    requestBody,
    responseText,
    responseJson,
    durationMs: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ *
 * Signature helpers (per Yedpay docs + official PHP SDK):
 *   1. drop `sign` and `sign_type`
 *   2. ksort the top-level fields
 *   3. build a PHP-style query string (RFC1738), then URL-decode it
 *   4. HMAC-SHA256 (hex) with the sign key
 * ------------------------------------------------------------------ */

type NestedParams = Record<string, string | Record<string, string>>;

/** Parse a urlencoded body, supporting PHP bracket notation (a[b]=c). */
export function parseFormBody(raw: string): NestedParams {
  const out: NestedParams = {};
  const qs = new URLSearchParams(raw);
  for (const [key, value] of qs.entries()) {
    const m = key.match(/^([^\[]+)\[([^\]]*)\]$/);
    if (m) {
      const [, parent, child] = m;
      const existing = out[parent];
      const bucket: Record<string, string> =
        existing && typeof existing === "object" ? existing : {};
      bucket[child] = value;
      out[parent] = bucket;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** PHP urlencode (RFC1738): space -> '+', '~' -> '%7E'. */
function phpUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/!/g, "%21");
}

/** PHP http_build_query over a (one-level-nested) params object. */
function phpBuildQuery(params: NestedParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "object" && value !== null) {
      for (const [subKey, subVal] of Object.entries(value)) {
        parts.push(
          `${phpUrlEncode(key)}[${phpUrlEncode(subKey)}]=${phpUrlEncode(String(subVal))}`,
        );
      }
    } else {
      parts.push(`${phpUrlEncode(key)}=${phpUrlEncode(String(value))}`);
    }
  }
  return parts.join("&");
}

/** PHP urldecode over a full query string. */
function phpUrlDecode(s: string): string {
  return decodeURIComponent(s.replace(/\+/g, "%20"));
}

/**
 * Build the exact string-to-sign for a notification payload and return both
 * the computed HMAC and the decoded source string (useful for the UI).
 */
export function computeSignature(
  params: NestedParams,
  signKey: string,
): { sourceString: string; sign: string } {
  const cleaned: NestedParams = { ...params };
  delete (cleaned as Record<string, unknown>)["sign"];
  delete (cleaned as Record<string, unknown>)["sign_type"];
  const sortedKeys = Object.keys(cleaned).sort();
  const sorted: NestedParams = {};
  for (const k of sortedKeys) sorted[k] = cleaned[k];
  const sourceString = phpUrlDecode(phpBuildQuery(sorted));
  const sign = crypto
    .createHmac("sha256", signKey)
    .update(sourceString, "utf8")
    .digest("hex");
  return { sourceString, sign };
}

export function verifySignature(
  rawBody: string,
  signKey: string,
): {
  valid: boolean;
  computedSign: string;
  receivedSign: string;
  sourceString: string;
  parsed: NestedParams;
} {
  const parsed = parseFormBody(rawBody);
  const receivedSign = typeof parsed.sign === "string" ? parsed.sign : "";
  const { sourceString, sign } = computeSignature(parsed, signKey);
  return {
    valid: !!receivedSign && sign === receivedSign,
    computedSign: sign,
    receivedSign,
    sourceString,
    parsed,
  };
}
