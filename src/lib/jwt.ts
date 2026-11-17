import { createSign } from "node:crypto";

// Service-account JWT for Google's OAuth token endpoint (no server-only imports: unit-testable).

export type Creds = { email: string; key: string };

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** RS256-signed JWT for Google's OAuth token endpoint (service-account flow). */
export function signJwt(creds: Creds, now = Math.floor(Date.now() / 1000)) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: creds.email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(creds.key).toString("base64url");
  return `${unsigned}.${signature}`;
}
