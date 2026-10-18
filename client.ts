// HTTP client for the CRM API. Every call runs as the signed-in user: the page
// passes a short-lived `session_token` (crma_…) in the thread vars and we send
// it as a bearer token. The API derives the org and user from that token alone.

/** A failed CRM call. `status` drives what the agent should do next:
 * 401 session expired · 403 not allowed · 404 not found · 422 a business rule
 * (message says which) · 400 malformed input. */
export class CrmError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CrmError";
  }
}

function baseUrl(): string {
  const raw = meta.vars?.crm_api_url;
  if (typeof raw !== "string" || !raw) {
    throw new Error("crm_api_url is not set. Add it as an agent variable (e.g. https://crm.example.com).");
  }
  const url = new URL(raw);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error(`crm_api_url must be https (got ${url.protocol}//${url.host}).`);
  }
  return url.origin;
}

function sessionToken(): string {
  const token = meta.vars?.session_token;
  if (typeof token !== "string" || !token.startsWith("crma_")) {
    throw new CrmError(401, "No CRM session. Ask the user to reopen the assistant panel.");
  }
  return token;
}

type Query = Record<string, string | number | boolean | null | undefined>;

/** Call `/api{path}`. Throws CrmError with the API's own message on failure. */
export async function api<T>(
  method: "GET" | "POST" | "PATCH" | "PUT",
  path: string,
  options: { body?: unknown; query?: Query } = {},
): Promise<T> {
  const url = new URL(`/api${path}`, baseUrl());
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      authorization: `Bearer ${sessionToken()}`,
      accept: "application/json",
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      (data?.error?.issues?.[0]?.message as string | undefined) ||
      text.slice(0, 200) ||
      res.statusText;
    throw new CrmError(res.status, `CRM ${method} ${path} failed (${res.status}): ${message}`, data?.details ?? data?.error);
  }
  return data as T;
}
