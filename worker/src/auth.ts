// Board JWT verification — RS256 against a PEM-encoded public key, optionally
// pinned to a known issuer. Mirrors back/src/auth.rs behavior:
//   - Authorization: Bearer <jwt>
//   - audience NOT validated
//   - issuer validated only if CLERK_ISSUER_URL is set
//   - subject becomes the authenticated user id

import type { Context, MiddlewareHandler } from "hono";
import { importSPKI, jwtVerify, type KeyLike } from "jose";
import type { Env, Variables } from "./types";

const ALG = "RS256";

export const DEFAULT_AUTHORIZED_PARTIES = [
  "https://focus.tixer.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

let cachedKey: KeyLike | null = null;
let cachedPem: string | null = null;

async function getPublicKey(rawPem: string): Promise<KeyLike> {
  if (cachedKey && cachedPem === rawPem) return cachedKey;
  const pem = rawPem.replace(/\\n/g, "\n");
  cachedKey = await importSPKI(pem, ALG);
  cachedPem = rawPem;
  return cachedKey;
}

function unauthorized(c: Context, message: string) {
  return c.json({ error: message }, 401);
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> =
  async (c, next) => {
    const header = c.req.header("authorization");
    if (!header) return unauthorized(c, "Missing authorization header");

    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) return unauthorized(c, "Invalid authorization header format");

    if (!c.env.CLERK_PEM_PUBLIC_KEY) {
      return c.json({ error: "CLERK_PEM_PUBLIC_KEY not set" }, 500);
    }

    let key: KeyLike;
    try {
      key = await getPublicKey(c.env.CLERK_PEM_PUBLIC_KEY);
    } catch (e) {
      return c.json({ error: `Invalid PEM key: ${(e as Error).message}` }, 500);
    }

    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [ALG],
        issuer: c.env.CLERK_ISSUER_URL || undefined,
      });
      const sub = payload.sub;
      if (!sub) return unauthorized(c, "Invalid token: missing sub");
      c.set("userId", sub);
    } catch (e) {
      return unauthorized(c, `Invalid token: ${(e as Error).message}`);
    }

    await next();
  };

export const requireFinanceAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> =
  async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || token.length > 16384) return c.json({ error: "Unauthorized" }, 401);

    let key: KeyLike;
    let parties: readonly string[];
    try {
      const issuer = c.env.CLERK_ISSUER_URL;
      if (!issuer || new URL(issuer).origin !== issuer || !c.env.CLERK_PEM_PUBLIC_KEY) {
        throw new Error();
      }
      parties = c.env.CLERK_AUTHORIZED_PARTIES === undefined
        ? DEFAULT_AUTHORIZED_PARTIES
        : c.env.CLERK_AUTHORIZED_PARTIES.split(",").map(value => value.trim());
      if (!parties.length || parties.some(origin => !origin || new URL(origin).origin !== origin)) {
        throw new Error();
      }
      key = await getPublicKey(c.env.CLERK_PEM_PUBLIC_KEY);
    } catch {
      return c.json({ error: "Finance unavailable" }, 503);
    }

    try {
      // boffin: kept finance session requirements separate from the board's older token contract.
      const { payload } = await jwtVerify(token, key, {
        algorithms: [ALG], issuer: c.env.CLERK_ISSUER_URL,
        requiredClaims: ["exp", "nbf", "sub", "sid", "azp"],
      });
      if (typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 256 ||
        typeof payload.sid !== "string" || !payload.sid.trim() || payload.sid.length > 256 ||
        typeof payload.azp !== "string" || !parties.includes(payload.azp) ||
        !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.nbf) ||
        payload.sts === "pending") {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("userId", payload.sub);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
