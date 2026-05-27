// ============================================
// ENABLE BANKING CLIENT
// ============================================
//
// Enable Banking is an AISP aggregator. We hold a PKCS8 private key whose
// public half is registered with them. On each API call we sign a fresh
// RS256 JWT (kid = our application id) and send it as Authorization: Bearer.
// No separate token-exchange endpoint exists — the JWT itself is the token.
//
// Docs: https://enablebanking.com/docs/api/reference/

const BASE = "https://api.enablebanking.com";
const ISS = "enablebanking.com";
const AUD = "api.enablebanking.com";

// ============================================
// JWT — RS256 signing via Web Crypto
// ============================================

const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// PEM → ArrayBuffer (PKCS8 DER body between BEGIN/END markers).
function pemToPkcs8(pem: string): ArrayBuffer {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;
let cachedPem: string | null = null;

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (cachedKey && cachedPem === pem) return cachedKey;
  const der = pemToPkcs8(pem);
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  cachedPem = pem;
  return cachedKey;
}

export async function signJwt(appId: string, privateKeyPem: string, ttlSeconds = 3600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const payload = { iss: ISS, aud: AUD, iat: now, exp: now + ttlSeconds };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}

// ============================================
// CLIENT
// ============================================

export interface ApplicationInfo {
  name: string;
  description?: string;
  kid: string;
  environment: "SANDBOX" | "PRODUCTION";
  active: boolean;
  countries: string[];
  services: string[];
  redirect_urls?: string[];
}

export interface EbAspsp {
  name: string;
  country: string;
  bic?: string;
  logo?: string;
  // many more — we only use a subset
}

// Sparse object returned in POST /sessions and GET /sessions/{id} —
// just enough to identify the account; full data needs /accounts/{uid}/details.
export interface EbAccount {
  uid: string;
  identification_hash?: string;
}

// Returned by GET /accounts/{uid}/details — the rich data.
export interface EbAccountDetails {
  account_id?: { iban?: string; other?: { identification: string } };
  name?: string;
  product?: string;
  currency: string;
  details?: string;
  cash_account_type?: string;
  account_servicer?: { name?: string };
}

export type EbSessionStatus = "PENDING_AUTHORIZATION" | "AUTHORIZED" | "EXPIRED" | "REVOKED" | "INVALID";

export interface EbSession {
  session_id: string;
  status: EbSessionStatus;
  aspsp: { name: string; country: string };
  authorized_at?: string;
  accounts?: string[];                // account uids
  accounts_data?: EbAccount[];
  access?: { valid_until?: string };
}

export interface EbTransaction {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  status: string;                     // 'BOOK' | 'PDNG' | 'INFO' etc
  booking_date?: string;              // YYYY-MM-DD
  value_date?: string;
  transaction_date?: string;
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
  bank_transaction_code?: { description?: string };
}

export interface EbTransactionsResponse {
  transactions: EbTransaction[];
  continuation_key?: string;
}

export interface ClientOpts {
  appId: string;
  privateKeyPem: string;
}

export class EnableBankingClient {
  private appId: string;
  private privateKeyPem: string;

  constructor(opts: ClientOpts) {
    this.appId = opts.appId;
    this.privateKeyPem = opts.privateKeyPem;
  }

  private async authHeader(): Promise<string> {
    const jwt = await signJwt(this.appId, this.privateKeyPem);
    return `Bearer ${jwt}`;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: HeadersInit = {
      Authorization: await this.authHeader(),
      "Content-Type": "application/json",
    };
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      // Surface the raw EB response in the worker logs so we can diagnose
      // what they actually rejected (e.g. unknown ASPSP, redirect mismatch).
      console.error(`[EnableBanking] ${method} ${path} → ${res.status}: ${text}`);
      throw new EnableBankingError(res.status, text, path);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  // GET /application — sanity-check creds + see what services/countries are live
  getApplication(): Promise<ApplicationInfo> {
    return this.req<ApplicationInfo>("GET", "/application");
  }

  // GET /aspsps?country=ES — list available banks
  listAspsps(country?: string): Promise<{ aspsps: EbAspsp[] }> {
    return this.req<{ aspsps: EbAspsp[] }>("GET", country ? `/aspsps?country=${country}` : "/aspsps");
  }

  // GET /sessions/{id} — full session info incl. authorized account uids.
  // Note: Enable Banking has NO bulk "list sessions" endpoint — the
  // application must know each session_id (find it in the Control Panel
  // request logs after linking accounts).
  getSession(sessionId: string): Promise<EbSession> {
    return this.req<EbSession>("GET", `/sessions/${sessionId}`);
  }

  // POST /auth — start an authorization. Returns a URL we redirect the
  // user to so they can complete SCA at their bank.
  startAuth(opts: {
    aspspName: string;
    aspspCountry: string;
    state: string;
    redirectUrl: string;
    psuType?: "personal" | "business";
    validUntilIso: string;
  }): Promise<{ url: string; authorization_id: string; psu_id_hash?: string }> {
    return this.req("POST", "/auth", {
      access: { valid_until: opts.validUntilIso },
      aspsp: { name: opts.aspspName, country: opts.aspspCountry },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: opts.psuType ?? "personal",
    });
  }

  // POST /sessions — finalize an authorization with the `code` returned
  // to the redirect URL after successful SCA. Returns the session_id and
  // the account UIDs it exposes.
  createSession(code: string): Promise<EbSession> {
    return this.req<EbSession>("POST", "/sessions", { code });
  }

  // GET /accounts/{uid}/details — rich account info (name, IBAN, currency).
  // POST /sessions only returns account UIDs; we need this to populate
  // anything useful for the UI.
  getAccountDetails(uid: string): Promise<EbAccountDetails> {
    return this.req<EbAccountDetails>("GET", `/accounts/${uid}/details`);
  }

  // GET /accounts/{uid}/transactions?date_from=...&date_to=...
  getTransactions(
    accountUid: string,
    params: { dateFrom?: string; dateTo?: string; continuationKey?: string } = {},
  ): Promise<EbTransactionsResponse> {
    const qs = new URLSearchParams();
    if (params.dateFrom) qs.set("date_from", params.dateFrom);
    if (params.dateTo) qs.set("date_to", params.dateTo);
    if (params.continuationKey) qs.set("continuation_key", params.continuationKey);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.req<EbTransactionsResponse>("GET", `/accounts/${accountUid}/transactions${suffix}`);
  }

  // DELETE /sessions/{id} — revoke the authorization
  deleteSession(sessionId: string): Promise<void> {
    return this.req<void>("DELETE", `/sessions/${sessionId}`);
  }
}

export class EnableBankingError extends Error {
  constructor(public status: number, public body: string, public path: string) {
    super(`Enable Banking ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = "EnableBankingError";
  }
}

// ============================================
// TRANSACTION NORMALIZATION
// ============================================

// Convert Enable Banking's CRDT/DBIT + positive-amount-string convention
// into a signed cents integer (negative = outflow).
export function normalizeAmountCents(tx: EbTransaction): number {
  const n = Number(tx.transaction_amount.amount);
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  return tx.credit_debit_indicator === "DBIT" ? -cents : cents;
}

export function counterpartyOf(tx: EbTransaction): string | null {
  // Use whichever side opposite the transaction direction
  if (tx.credit_debit_indicator === "DBIT") return tx.creditor?.name ?? null;
  return tx.debtor?.name ?? null;
}

export function descriptionOf(tx: EbTransaction): string | null {
  if (tx.remittance_information && tx.remittance_information.length > 0) {
    return tx.remittance_information.filter(Boolean).join(" · ");
  }
  return tx.bank_transaction_code?.description ?? null;
}

// Stable id for dedup: prefer transaction_id, fall back to entry_reference,
// fall back to a synthetic from date+amount+counterparty (best-effort).
export function ebTransactionId(tx: EbTransaction): string {
  if (tx.transaction_id) return tx.transaction_id;
  if (tx.entry_reference) return `ref:${tx.entry_reference}`;
  const date = tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? "";
  const cp = counterpartyOf(tx) ?? "";
  const amt = tx.transaction_amount.amount;
  return `syn:${date}|${amt}|${cp}`;
}
