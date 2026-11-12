export type FieldType = "text" | "textarea" | "select" | "switch";

export interface FieldSpec {
  name: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  default?: string;
  auto?: "customId";
}

export interface EndpointSpec {
  key: string;
  label: string;
  group: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  description: string;
  fields: FieldSpec[];
}

export const GATEWAY_CODES = [
  { value: "", label: "All available gateways (default)" },
  { value: "4_1", label: "4_1 — Alipay (Mobile: 手機網站喚起 AlipayHK)" },
  { value: "4_2", label: "4_2 — Alipay (Desktop→Mobile QR Code)" },
  { value: "4_3", label: "4_3 — Alipay SDK (App-to-App)" },
  { value: "8_2", label: "8_2 — WeChat Pay (All-in-one)" },
  { value: "8_3", label: "8_3 — WeChat Pay SDK (App-to-App)" },
  { value: "16_4", label: "16_4 — UnionPay UPOP" },
  { value: "16_5", label: "16_5 — UnionPay QR Code" },
  { value: "19_1", label: "19_1 — Visa (信用卡網上付款)" },
  { value: "19_2", label: "19_2 — MasterCard (信用卡網上付款)" },
  { value: "13_1", label: "13_1 — HSBC FPS Online" },
  { value: "13_2", label: "13_2 — HSBC FPS Offline" },
  { value: "13_3", label: "13_3 — DBS FPS Online" },
  { value: "13_4", label: "13_4 — DBS FPS Offline" },
  { value: "20_2", label: "20_2 — HSBC PayMe Online" },
];

export const ENDPOINTS: EndpointSpec[] = [
  {
    key: "createPaymentLink",
    label: "Create Payment Link",
    group: "Online Payment",
    method: "POST",
    path: "/online-payment",
    description:
      "Creates a checkout link for an online payment. Redirect the customer to the returned link to complete the transaction.",
    fields: [
      { name: "amount", label: "amount", required: true, default: "1.00", hint: "Numeric string, max 2 decimal places" },
      {
        name: "currency", label: "currency", required: true, type: "select",
        options: [
          { value: "HKD", label: "HKD" },
          { value: "USD", label: "USD" },
        ],
        default: "HKD",
      },
      { name: "customId", label: "custom_id", required: true, auto: "customId", hint: "Letters, numbers, underscore and dash — max 36 chars" },
      { name: "merchantReference", label: "merchant_reference", placeholder: "order-2026-0001", hint: "Merchant-side reference for this payment" },
      { name: "merchantUserId", label: "merchant_user_id", placeholder: "user-1001", hint: "Merchant-side customer / user identifier" },
      { name: "returnUrl", label: "return_url", placeholder: "https://…", hint: "Redirect URL when finished — Yedpay rejects localhost URLs (403); use the public preview URL" },
      { name: "returnUrlFailed", label: "return_url_failed", placeholder: "https://…", hint: "Redirect URL for failed / cancelled / expired outcomes" },
      { name: "notifyUrl", label: "notify_url", placeholder: "https://…", hint: "Async notification endpoint — ports 80/443 only, no localhost" },
      { name: "subject", label: "subject", placeholder: "Product name" },
      { name: "gatewayCode", label: "gateway_code", type: "select", options: GATEWAY_CODES, hint: "Empty = all gateways — tick allowed ones below" },
      { name: "allowedGateways", label: "allowed_gateways", type: "textarea", placeholder: '{"1":{"admin_fee":"0.022"},"7":{"admin_fee":"0.022","specific_gateway":["4_2"]}}', hint: "JSON — restricts which gateways the checkout page shows (use the tick-boxes above, or edit raw)" },
      {
        name: "wallet", label: "wallet", type: "select",
        options: [
          { value: "", label: "—" },
          { value: "HK", label: "HK" },
          { value: "CN", label: "CN" },
        ],
        hint: "Required for Alipay gateway codes 4_1 / 4_2 / 4_3",
      },
      { name: "expiryTime", label: "expiry_time", placeholder: "10800", hint: "Seconds, 300–10800 (5 min – 3 h)" },
      { name: "extraParameters", label: "extra_parameters", type: "textarea", placeholder: '{"extra_1":"value_1"}', hint: "JSON string, max 6000 chars" },
      { name: "paymentData", label: "payment_data", type: "textarea", placeholder: '{"first_name":"Chan","last_name":"Tai Man","email":"test@example.com"}', hint: "Card payment only — payer & billing fields as JSON" },
      { name: "checkoutDomainId", label: "checkout_domain_id", hint: "Hash id of checkout domain" },
      { name: "isAuthorization", label: "is_authorization", type: "switch", hint: "True = pre-auth transaction instead of regular payment" },
      {
        name: "lang", label: "lang", type: "select",
        options: [
          { value: "", label: "System default (zh)" },
          { value: "zh", label: "zh — Traditional Chinese" },
          { value: "en", label: "en — English" },
        ],
      },
      { name: "disableAlipayAppAutoOpen", label: "disable_alipay_app_auto_open", type: "switch", hint: "Prevents the Alipay app from opening automatically" },
    ],
  },
  {
    key: "queryPayment",
    label: "Query Payment",
    group: "Online Payment",
    method: "GET",
    path: "/online-payment/query",
    description:
      "Queries the transaction of an online payment by custom_id or payment_token.",
    fields: [
      { name: "customId", label: "custom_id", auto: "customId", hint: "Required without payment_token" },
      { name: "paymentToken", label: "payment_token", hint: "Required without custom_id" },
    ],
  },
  {
    key: "refundByCustomId",
    label: "Refund by Custom ID",
    group: "Online Payment",
    method: "PUT",
    path: "/online-payment/{custom_id}/refund",
    description: "Refunds the selected online payment, addressed by its custom_id.",
    fields: [
      { name: "customId", label: "custom_id", required: true },
      { name: "refundReason", label: "refund_reason", placeholder: "Reason of refund" },
      { name: "amount", label: "amount", placeholder: "Leave empty = full refund", hint: "Min 0.1, max = transaction amount" },
    ],
  },
  {
    key: "refundByTransactionId",
    label: "Refund by Transaction ID",
    group: "Online Payment",
    method: "POST",
    path: "/transactions/{transaction_id}/refund",
    description: "Refunds a transaction addressed by the Yedpay transaction id.",
    fields: [
      { name: "transactionId", label: "transaction_id", required: true },
      { name: "refundReason", label: "refund_reason", placeholder: "Reason of refund" },
      { name: "amount", label: "amount", placeholder: "Leave empty = full refund" },
    ],
  },
  {
    key: "listAuthorizations",
    label: "List Pre-Authorizations",
    group: "Pre-Authorization",
    method: "GET",
    path: "/companies/{company_id}/authorizations",
    description: "Retrieves the pre-authorizations of the API key's store, newest first.",
    fields: [{ name: "companyId", label: "company_id", required: true }],
  },
  {
    key: "getAuthorization",
    label: "Get Pre-Authorization",
    group: "Pre-Authorization",
    method: "GET",
    path: "/companies/{company_id}/authorizations/{authorization_id}?include=transactions",
    description: "Retrieves one pre-authorization including its captured transactions.",
    fields: [
      { name: "companyId", label: "company_id", required: true },
      { name: "authorizationId", label: "authorization_id", required: true, hint: "Encoded authorization ID from the list call" },
    ],
  },
  {
    key: "captureAuthorization",
    label: "Capture Pre-Authorization",
    group: "Pre-Authorization",
    method: "PUT",
    path: "/authorization/{authorization_id}/capture",
    description: "Captures a pre-authorization, converting it to a completed payment.",
    fields: [
      { name: "authorizationId", label: "authorization_id", required: true },
      { name: "amount", label: "amount", required: true, hint: "Max 2 decimal places" },
      {
        name: "currency", label: "currency", type: "select",
        options: [
          { value: "HKD", label: "HKD" },
          { value: "USD", label: "USD" },
        ],
        default: "HKD",
      },
    ],
  },
  {
    key: "cancelAuthorization",
    label: "Cancel Pre-Authorization",
    group: "Pre-Authorization",
    method: "PUT",
    path: "/authorization/{authorization_id}/cancel",
    description: "Cancels an existing pre-authorization, releasing the held funds.",
    fields: [{ name: "authorizationId", label: "authorization_id", required: true }],
  },
  {
    key: "incrementalAuthorization",
    label: "Incremental Pre-Authorization",
    group: "Pre-Authorization",
    method: "PUT",
    path: "/authorization/{authorization_id}/increment",
    description: "Increases the held amount of an existing pre-authorization.",
    fields: [
      { name: "authorizationId", label: "authorization_id", required: true },
      { name: "amount", label: "amount", required: true },
      {
        name: "currency", label: "currency", type: "select",
        options: [
          { value: "HKD", label: "HKD" },
          { value: "USD", label: "USD" },
        ],
        default: "HKD",
      },
    ],
  },
  {
    key: "customRequest",
    label: "Custom Request",
    group: "Tools",
    method: "POST",
    path: "/{any path}",
    description:
      "Fire any request against the Yedpay API with your own method, path and parameters — for endpoints not covered above.",
    fields: [
      {
        name: "method", label: "method", type: "select", required: true,
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" },
        ],
        default: "GET",
      },
      { name: "path", label: "path", required: true, placeholder: "/online-payment/query" , hint: "Path under /v1, or a full https:// URL" },
      {
        name: "params", label: "params", type: "textarea",
        placeholder: '{\n  "custom_id": "test-001"\n}',
        hint: "JSON object of parameters — sent as query string for GET/DELETE, form body otherwise",
      },
    ],
  },
];

export const GROUPS = ["Online Payment", "Pre-Authorization", "Tools"];
