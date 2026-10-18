// urai-crm-lib — the CRM, for the in-app assistant.
//
//   import { findDeals, moveDeal, logInteraction, showDeal } from "urai:lib/urai/urai-crm-lib";
//
// Every function calls the CRM API as the signed-in user (see client.ts) and
// throws CrmError on failure. See AGENT.md for the agent-facing reference.

import { api, CrmError } from "./client.ts";
import {
  ACTIVE_STAGES,
  type Channel,
  type CloseReason,
  type Company,
  type CompanyType,
  type Contact,
  type Deal,
  type DealType,
  type Interaction,
  type InteractionResult,
  type InteractionType,
  type PartnerStatus,
  type SearchHit,
  type Source,
  type Sprint,
  STAGES,
  type Stage,
  type TaggableType,
  type Tag,
  type Worksheet,
} from "./types.ts";
import { show, type PipelineSnapshotProps } from "./ui.ts";

export { CrmError } from "./client.ts";
export * from "./types.ts";
export { confirm, links, navigate, refresh, show } from "./ui.ts";

const contains = (hay: string | null | undefined, needle: string) =>
  !!hay && hay.toLowerCase().includes(needle.toLowerCase());

/** Unix seconds from a Date, ISO string, or unix seconds. */
function toUnixSeconds(at: Date | string | number): number {
  if (typeof at === "number") return at > 1e12 ? Math.floor(at / 1000) : Math.floor(at);
  const ms = (at instanceof Date ? at : new Date(at)).getTime();
  if (Number.isNaN(ms)) throw new Error(`not a date: ${String(at)}`);
  return Math.floor(ms / 1000);
}

// ─── search ────────────────────────────────────────────────────────────────

/** Full-text search across companies, contacts and deals (names, emails,
 * titles, notes, event names, tag names). Prefix-matches each word. */
export async function search(query: string): Promise<SearchHit[]> {
  const { results } = await api<{ results: { entityType: TaggableType; entityId: string; title: string }[] }>(
    "GET",
    "/search",
    { query: { q: query } },
  );
  return results.map((r) => ({ type: r.entityType, id: r.entityId, title: r.title }));
}

// ─── companies ─────────────────────────────────────────────────────────────

export async function listCompanies(filter: { query?: string; limit?: number } = {}): Promise<Company[]> {
  const { companies } = await api<{ companies: Company[] }>("GET", "/companies");
  const q = filter.query?.trim();
  const hits = q ? companies.filter((c) => contains(c.name, q) || contains(c.website, q)) : companies;
  return hits.slice(0, filter.limit ?? 50);
}

export async function getCompany(id: string): Promise<Company> {
  return (await api<{ company: Company }>("GET", `/companies/${encodeURIComponent(id)}`)).company;
}

export async function createCompany(input: {
  name: string;
  type?: CompanyType;
  businessType?: string;
  website?: string;
  notes?: string;
}): Promise<Company> {
  return (await api<{ company: Company }>("POST", "/companies", { body: input })).company;
}

export async function updateCompany(
  id: string,
  patch: Partial<{ name: string; type: CompanyType; businessType: string | null; website: string | null; notes: string | null }>,
): Promise<Company> {
  return (await api<{ company: Company }>("PATCH", `/companies/${encodeURIComponent(id)}`, { body: patch })).company;
}

// ─── contacts ──────────────────────────────────────────────────────────────

export async function listContacts(
  filter: { query?: string; companyId?: string; limit?: number } = {},
): Promise<Contact[]> {
  const { contacts } = await api<{ contacts: Contact[] }>("GET", "/contacts");
  const q = filter.query?.trim();
  return contacts
    .filter((c) => !filter.companyId || c.companyId === filter.companyId)
    .filter((c) => !q || contains(c.name, q) || contains(c.email, q) || contains(c.title, q))
    .slice(0, filter.limit ?? 50);
}

export async function getContact(id: string): Promise<Contact> {
  return (await api<{ contact: Contact }>("GET", `/contacts/${encodeURIComponent(id)}`)).contact;
}

/** Source must suit the channel (see SOURCES_BY_CHANNEL); REFERRAL needs
 * `introducedByContactId`; `eventName` is for NETWORK / EVENT. */
export async function createContact(input: {
  name: string;
  channel: Channel;
  source: Source;
  email?: string;
  phone?: string;
  title?: string;
  country?: string;
  province?: string;
  city?: string;
  linkedinUrl?: string;
  companyId?: string;
  introducedByContactId?: string;
  eventName?: string;
  notes?: string;
}): Promise<Contact> {
  return (await api<{ contact: Contact }>("POST", "/contacts", { body: input })).contact;
}

export async function updateContact(
  id: string,
  patch: Partial<Omit<Contact, "id" | "createdAt" | "updatedAt">>,
): Promise<Contact> {
  return (await api<{ contact: Contact }>("PATCH", `/contacts/${encodeURIComponent(id)}`, { body: patch })).contact;
}

// ─── deals ─────────────────────────────────────────────────────────────────

export async function listDeals(
  filter: {
    query?: string;
    stage?: Stage | Stage[];
    /** true: active stages only; false: closed/nurture only. */
    open?: boolean;
    companyId?: string;
    contactId?: string;
    dealType?: DealType;
    limit?: number;
  } = {},
): Promise<Deal[]> {
  const { deals } = await api<{ deals: Deal[] }>("GET", "/deals");
  const stages = filter.stage ? new Set(([] as Stage[]).concat(filter.stage)) : null;
  const active = new Set<Stage>(ACTIVE_STAGES);
  const q = filter.query?.trim();
  return deals
    .filter((d) => !stages || stages.has(d.stage))
    .filter((d) => filter.open === undefined || active.has(d.stage) === filter.open)
    .filter((d) => !filter.companyId || d.companyId === filter.companyId)
    .filter((d) => !filter.contactId || d.primaryContactId === filter.contactId)
    .filter((d) => !filter.dealType || d.dealType === filter.dealType)
    .filter((d) => !q || contains(d.name, q))
    .slice(0, filter.limit ?? 50);
}

export async function getDeal(id: string): Promise<Deal> {
  return (await api<{ deal: Deal }>("GET", `/deals/${encodeURIComponent(id)}`)).deal;
}

/** Channel, source and entry stage come from the primary contact
 * (OUTBOUND → NEW, INBOUND → CONTACTED). */
export async function createDeal(input: {
  name: string;
  primaryContactId: string;
  companyId?: string;
  dealType?: DealType;
  probability?: number;
  value?: number | null;
  introducedByContactId?: string;
}): Promise<Deal> {
  return (await api<{ deal: Deal }>("POST", "/deals", { body: input })).deal;
}

/** Edit fields. To change stage use moveDeal. */
export async function updateDeal(
  id: string,
  patch: Partial<{
    name: string;
    companyId: string | null;
    probability: number;
    value: number | null;
    partnerStatus: PartnerStatus | null;
  }>,
): Promise<Deal> {
  return (await api<{ deal: Deal }>("PATCH", `/deals/${encodeURIComponent(id)}`, { body: patch })).deal;
}

/**
 * Move a deal to `stage`. The CRM enforces the pipeline: qualify before
 * PROPOSAL/TRIAL/NEGOTIATION/CLOSED_WON; CLOSED_LOST and CLOSED_DISQUALIFIED
 * need `closeReason`; only NURTURE→NEW/CONTACTED and CLOSED_LOST(TIMING)→NEW
 * re-open. A refused move throws CrmError 422 with the reason.
 */
export async function moveDeal(
  id: string,
  stage: Stage,
  options: { closeReason?: CloseReason; probability?: number } = {},
): Promise<Deal> {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage ${stage}; use one of ${STAGES.join(", ")}`);
  return (
    await api<{ deal: Deal }>("POST", `/deals/${encodeURIComponent(id)}/move`, {
      body: { stage, ...options },
    })
  ).deal;
}

// ─── interactions ──────────────────────────────────────────────────────────

/** Log a touch against a deal, attributed to the user. `at` defaults to now. */
export async function logInteraction(
  dealId: string,
  input: { type: InteractionType; result: InteractionResult; notes?: string; at?: Date | string | number },
): Promise<Interaction> {
  return (
    await api<{ interaction: Interaction }>("POST", `/deals/${encodeURIComponent(dealId)}/interactions`, {
      body: {
        interactionType: input.type,
        result: input.result,
        notes: input.notes ?? null,
        ...(input.at !== undefined ? { occurredAt: toUnixSeconds(input.at) } : {}),
      },
    })
  ).interaction;
}

/** A deal's interactions, newest first. */
export async function listInteractions(dealId: string): Promise<Interaction[]> {
  return (await api<{ interactions: Interaction[] }>("GET", `/deals/${encodeURIComponent(dealId)}/interactions`))
    .interactions;
}

/** The team's latest interactions across all deals, newest first. */
export async function recentActivity(limit = 20): Promise<Interaction[]> {
  return (await api<{ interactions: Interaction[] }>("GET", "/interactions")).interactions.slice(0, limit);
}

// ─── worksheet ─────────────────────────────────────────────────────────────

export async function getWorksheet(dealId: string): Promise<Worksheet | null> {
  return (await api<{ conversation: Worksheet | null }>("GET", `/deals/${encodeURIComponent(dealId)}/conversation`))
    .conversation;
}

/** Save only the fields you pass; others are left as they are. */
export async function saveWorksheet(dealId: string, fields: Worksheet): Promise<Worksheet> {
  const { id: _id, dealId: _dealId, ...patch } = fields;
  return (
    await api<{ conversation: Worksheet }>("PUT", `/deals/${encodeURIComponent(dealId)}/conversation`, {
      body: patch,
    })
  ).conversation;
}

// ─── reports ───────────────────────────────────────────────────────────────

/** Pipeline analytics: totals (win rate, cycle time, weighted pipeline),
 * stage conversion, time-in-stage, and a breakdown by `groupBy`. */
export function pipelineReport(
  filter: { channel?: Channel; source?: Source; dealType?: DealType; groupBy?: "channel" | "source" | "dealType" } = {},
): Promise<any> {
  return api("GET", "/reports", { query: filter });
}

/** Deal count and value per stage, plus the probability-weighted value of
 * open deals — the shape `showPipeline` renders. */
export async function pipelineSnapshot(filter: { dealType?: DealType } = {}): Promise<PipelineSnapshotProps> {
  const deals = await listDeals({ dealType: filter.dealType, limit: Infinity });
  const active = new Set<Stage>(ACTIVE_STAGES);
  const stages = STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, count: inStage.length, value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0) };
  }).filter((s) => s.count > 0 || active.has(s.stage));
  const weightedValue = deals
    .filter((d) => active.has(d.stage))
    .reduce((sum, d) => sum + ((d.value ?? 0) * d.probability) / 100, 0);
  return { stages, weightedValue: Math.round(weightedValue) };
}

// ─── sprints ───────────────────────────────────────────────────────────────

export async function listSprints(): Promise<Sprint[]> {
  return (await api<{ sprints: Sprint[] }>("GET", "/sprints")).sprints;
}

/** The sprint whose dates include today (UTC), or null. */
export async function currentSprint(): Promise<Sprint | null> {
  const today = new Date().toISOString().slice(0, 10);
  return (await listSprints()).find((s) => s.startDate <= today && today <= s.endDate) ?? null;
}

/** The sprint, its deals (with primary contact names), per-deal activity
 * rows, and the interaction count against its target. */
export function sprintDashboard(sprintId: string): Promise<any> {
  return api("GET", `/sprints/${encodeURIComponent(sprintId)}/dashboard`);
}

export async function addDealToSprint(sprintId: string, dealId: string): Promise<Deal> {
  return (await api<{ deal: Deal }>("POST", `/sprints/${encodeURIComponent(sprintId)}/deals`, { body: { dealId } }))
    .deal;
}

// ─── tags ──────────────────────────────────────────────────────────────────

export async function listTags(): Promise<Tag[]> {
  return (await api<{ tags: Tag[] }>("GET", "/tags")).tags;
}

/** Put tag `name` on a record, creating the tag if it's new. */
export async function tag(type: TaggableType, id: string, name: string): Promise<Tag> {
  const { tag: t } = await api<{ tag: Tag }>("POST", "/tags", { body: { name } });
  await api("POST", `/tags/${encodeURIComponent(t.id)}/attach`, { body: { taggableType: type, taggableId: id } });
  return t;
}

/** Take tag `name` off a record (the tag itself stays). */
export async function untag(type: TaggableType, id: string, name: string): Promise<void> {
  const t = (await listTags()).find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!t) throw new CrmError(404, `no tag named "${name}"`);
  await api("POST", `/tags/${encodeURIComponent(t.id)}/detach`, { body: { taggableType: type, taggableId: id } });
}

// ─── show in the chat ──────────────────────────────────────────────────────

/** Show a deal card (by deal or id), with its company and contact names. */
export async function showDeal(dealOrId: Deal | string): Promise<Deal> {
  const deal = typeof dealOrId === "string" ? await getDeal(dealOrId) : dealOrId;
  const [company, contact] = await Promise.all([
    deal.companyId ? getCompany(deal.companyId).catch(() => null) : null,
    getContact(deal.primaryContactId).catch(() => null),
  ]);
  await show("DealCard", {
    id: deal.id,
    name: deal.name,
    stage: deal.stage,
    value: deal.value,
    probability: deal.probability,
    dealType: deal.dealType,
    companyName: company?.name ?? null,
    contactName: contact?.name ?? null,
  });
  return deal;
}

/** Show a contact card (by contact or id), with its company name. */
export async function showContact(contactOrId: Contact | string): Promise<Contact> {
  const contact = typeof contactOrId === "string" ? await getContact(contactOrId) : contactOrId;
  const company = contact.companyId ? await getCompany(contact.companyId).catch(() => null) : null;
  await show("ContactCard", {
    id: contact.id,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    phone: contact.phone,
    channel: contact.channel,
    source: contact.source,
    companyName: company?.name ?? null,
  });
  return contact;
}

/** Show the pipeline by stage (computes pipelineSnapshot if not given). */
export async function showPipeline(snapshot?: PipelineSnapshotProps, title?: string): Promise<PipelineSnapshotProps> {
  const s = snapshot ?? (await pipelineSnapshot());
  await show("PipelineSnapshot", { ...s, title: title ?? s.title ?? null });
  return s;
}
