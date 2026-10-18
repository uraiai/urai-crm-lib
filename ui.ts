// Talk to the CRM page the user has open. Commands ride the open reply stream
// (`meta.urai.sendCommand`) and the page validates every one before acting —
// unknown components or off-app paths are dropped there.

import type { Stage } from "./types.ts";

async function send(payload: Record<string, unknown>): Promise<boolean> {
  const threadId = meta.vars?.thread_id;
  if (typeof threadId !== "string" || !threadId) {
    // Not in a chat (e.g. `uraijs eval`): nothing to show.
    console.log("[urai-crm-lib] no thread_id; skipped", JSON.stringify(payload));
    return false;
  }
  const { success } = await meta.urai.sendCommand(threadId, payload);
  return success;
}

/** Render one of the page's components inside your reply. */
export function show(
  component: "DealCard" | "ContactCard" | "PipelineSnapshot" | "ConfirmAction",
  props: Record<string, unknown>,
): Promise<boolean> {
  return send({ command: "displayComponent", component, props });
}

export interface DealCardProps {
  id: string;
  name: string;
  stage: Stage;
  value?: number | null;
  probability?: number | null;
  companyName?: string | null;
  contactName?: string | null;
  dealType?: "DIRECT" | "PARTNER" | null;
}

export interface ContactCardProps {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  channel?: "INBOUND" | "OUTBOUND" | null;
  source?: string | null;
}

export interface PipelineSnapshotProps {
  title?: string | null;
  stages: { stage: Stage; count: number; value?: number | null }[];
  weightedValue?: number | null;
}

/**
 * Ask the user to approve a change with Go ahead / Cancel buttons. Their click
 * arrives as the next user message: exactly "Yes, go ahead." or
 * "No, don't do that." — act on it then, not in this turn.
 */
export function confirm(
  summary: string,
  details?: string[],
  confirmLabel?: string,
): Promise<boolean> {
  return show("ConfirmAction", { summary, details, confirmLabel });
}

/** Take the user to a page in the app. Only `/app…` paths are honoured:
 * `/app` (contacts), `/app/companies`, `/app/pipeline`,
 * `/app/deals/<dealId>/worksheet`, `/app/sprints`, `/app/sprints/<sprintId>`,
 * `/app/analytics`, `/app/tags`, `/app/search?q=<text>`. */
export function navigate(path: string): Promise<boolean> {
  return send({ command: "navigate", path });
}

/** Reload the page's data after you change something, so the user sees it. */
export function refresh(): Promise<boolean> {
  return send({ command: "refresh" });
}

/** App links, for prose or `navigate()`. */
export const links = {
  contacts: () => "/app",
  companies: () => "/app/companies",
  pipeline: () => "/app/pipeline",
  dealWorksheet: (dealId: string) => `/app/deals/${encodeURIComponent(dealId)}/worksheet`,
  sprints: () => "/app/sprints",
  sprint: (sprintId: string) => `/app/sprints/${encodeURIComponent(sprintId)}`,
  analytics: () => "/app/analytics",
  search: (q: string) => `/app/search?q=${encodeURIComponent(q)}`,
};
