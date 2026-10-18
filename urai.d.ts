// urai.d.ts — ambient type definitions for the Urai runtime (editor support).
// Regenerate with `uraijs types`.

/** Schema for tool parameters (a JSON-Schema subset). */
interface Schema {
  type?: string;
  schema_type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  [key: string]: any;
}

/** A tool the model can call. */
interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Schema;
}

type ToolHandler = (args: any) => any;

interface ToolRegistry {
  addDeclarations(declarations: FunctionDeclaration[]): void;
  register(name: string, handler: ToolHandler): void;
  getDeclarations(): FunctionDeclaration[];
  lookup(name: string): { handler: ToolHandler; declaration: FunctionDeclaration } | null;
}

/** Global registry of tool declarations and their handlers. */
declare const ToolRegistry: ToolRegistry;

/** Decorator: register a static class method as a tool. */
declare const tool: (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;

/** Runtime-provided context. */
declare const meta: {
  /** Secrets provided per call, e.g. `meta.secrets.MY_API_KEY`. */
  secrets: Record<string, string | undefined>;
  /** Variables provided to the runtime, e.g. `meta.vars.MY_CONFIG`. */
  vars: Record<string, any | undefined>;
  urai: {
    /** Send a command to the client frontend (voice/chat), addressed by call/thread id. */
    sendCommand: (callId: string, command: any) => Promise<{ success: boolean }>;
  };
};

declare function fetchJSON(url: string): Promise<any>;
declare const urai: {
  sendResult: (result: any) => Promise<void>;
  /**
   * Base URL of the Urai host this uraijs is configured against
   * (`URAIJS_SECRETS_HOST_URL`), or `null` when it has none. `urai:chat` and
   * `urai:knowledge` use it when running outside a host, so the same code runs
   * against local, staging and production without a hardcoded default.
   */
  hostUrl: () => string | null;
};

/** Persistent objects: state that lives across executions (Postgres-backed). */
declare module "urai:persistence" {
  export interface PersistentState {
    /** Instance id (uuid) of this persistent object. */
    id: string;
    /** Last persisted state; `{}` on first construction. */
    state: Record<string, unknown>;
  }
  /** Class decorator: registers the constructor under its class name. */
  export function PersistentObject<T extends Function>(ctor: T): T;
}

/**
 * Durable workflows and steps. `run()` re-runs each tick; steps and approvals
 * memoize. Never wrap `runStep()` / `awaitApproval()` / `complete()` in
 * try/catch — they signal via thrown sentinels the host must see.
 */
declare module "urai:workers" {
  import type { PersistentState } from "urai:persistence";
  export type { PersistentState };
  /** How the wait between attempts grows. */
  export type BackoffStrategy = "fixed" | "linear" | "exponential";
  /** Per-step retry policy, declared once at `registerStep`. */
  export interface RetryOptions {
    /** Attempts after the first. 0 (default) means a failure fails the run. */
    retries?: number;
    /** Default "fixed". Every strategy waits `delayMs` before the first retry. */
    backoff?: BackoffStrategy;
    /** Base wait in milliseconds. Default 1000. */
    delayMs?: number;
  }
  export interface StepRef {
    name: string;
    stepType: string;
    retry?: { maxAttempts: number; backoff: BackoffStrategy; delayMs: number };
  }
  export interface WorkflowHandle { run(args?: unknown): Promise<void>; }
  export interface WorkflowContext {
    id: string;
    getWorkflow(type: string, id: string): WorkflowHandle;
  }
  /** What a human decided, as returned by `awaitApproval`. */
  export interface ApprovalDecision {
    approved: boolean;
    approver: string | null;
    decidedBy: string | null;
    comment: string | null;
    data: unknown;
    decidedAt: string;
  }
  /** Reserved for future options (e.g. `expiresInSecs`). */
  export interface ApprovalOptions { [key: string]: unknown; }
  export abstract class Workflow {
    readonly id: string;
    protected _state: Record<string, unknown>;
    constructor(env: PersistentState);
    /**
     * Register a named step -> Step subclass. Call from the constructor.
     * `opts` declares retries: a failed step is parked and run again after the
     * backoff, and fails the run once its attempts are spent. A retried step
     * re-runs from the top, so keep retryable steps idempotent.
     */
    registerStep(
      name: string,
      stepClass: new (...a: any[]) => Step,
      opts?: RetryOptions,
    ): StepRef;
    /** Memoized: returns `{ result }` if complete, else suspends the tick. */
    runStep(step: StepRef, args?: unknown): { result: unknown };
    /** Fan-out: run `step` once per entry in `argsList`, memoized per input. */
    runStepMany(step: StepRef, argsList: unknown[]): { results: unknown[] };
    /** Park on a human decision, memoized like a step. Rejection is a decision. */
    awaitApproval(name: string, request?: unknown, opts?: ApprovalOptions): ApprovalDecision;
    /** Finalize the workflow once every referenced step has completed. */
    complete(result: unknown): void;
    abstract run(args?: unknown): Promise<void> | void;
  }
  export abstract class Step {
    readonly id: string;
    protected _state: Record<string, unknown>;
    constructor(env: PersistentState, parent?: unknown);
    /** Record this step's output; the host persists it and ticks the parent. */
    completeStep(result: unknown): void;
    abstract run(args?: unknown): Promise<void> | void;
  }
}

/** Async secret access (host-proxied; use for expiring/OIDC-backed secrets). */
declare module "urai:secrets" {
  export class SecretManager {
    /** Resolve a secret by key. Rejects if it cannot be resolved. */
    get(key: string): Promise<string>;
  }
  /** Process-wide singleton. */
  export const secrets: SecretManager;
}

declare module "urai:fs" {
    /** What `stat` reports. `mtime` is milliseconds since the epoch. */
    export interface FileInfo {
        size: number;
        kind: "file" | "dir" | "symlink";
        mtime: number;
        mode: number;
    }
    export interface DirEntry { name: string; kind: "file" | "dir" | "symlink" }
    export interface GlobHit { path: string; size: number; mtime: number }
    /** Bytes and files used, against the caps this workspace is held to. */
    export interface Usage {
        bytes: number;
        files: number;
        maxBytes: number;
        maxFileBytes: number;
        maxFiles: number;
    }

    /** The workspace is full, or the file is too big. Nothing was written. */
    export class QuotaExceeded extends Error {}
    /** The workspace belongs to another process now. Do not retry. */
    export class WorkspaceLost extends Error {}
    /** No workspace is attached to this execution. See `fs.available()`. */
    export class NoWorkspace extends Error {}

    export class Fs {
        /** Whether this execution has a workspace at all. Check once, at the top. */
        available(): boolean;
        /**
         * Which workspace is attached. An opaque id, not the thread's or the
         * run's: a forked thread shares its parent's, and a workflow run gets
         * one per run or one per workflow by policy.
         */
        workspace(): string | null;
        read(path: string): Promise<Uint8Array>;
        readText(path: string): Promise<string>;
        readJSON<T = unknown>(path: string): Promise<T>;
        write(path: string, data: Uint8Array): Promise<void>;
        writeText(path: string, text: string): Promise<void>;
        writeJSON(path: string, value: unknown): Promise<void>;
        append(path: string, data: Uint8Array | string): Promise<void>;
        appendLine(path: string, line: string): Promise<void>;
        stat(path: string): Promise<FileInfo>;
        exists(path: string): Promise<boolean>;
        list(path: string): Promise<DirEntry[]>;
        glob(pattern: string): Promise<GlobHit[]>;
        mkdir(path: string): Promise<void>;
        remove(path: string, opts?: { recursive?: boolean }): Promise<void>;
        /** Make everything written so far durable. Call once, when it matters. */
        flush(): Promise<void>;
        usage(): Usage | null;
        decode(bytes: Uint8Array): string;
    }

    /** The workspace this execution is attached to. */
    export const fs: Fs;
}

declare module "urai:knowledge" {
  /** A document this execution may read. */
  export interface KnowledgeDocument {
    id: string;
    name: string;
    /** The collection it belongs to. */
    collection: string;
    /**
     * Size of the extracted text in bytes — what `read` pages through.
     * Absent until a document has been read once.
     */
    bytes?: number;
    /** Absent for formats without pages (Markdown, text, spreadsheets). */
    pages?: number;
    /**
     * Folders it is filed in, `/`-joined. Empty for a document at the
     * collection root. More than one entry is one document filed in several
     * places — same id, same text — not copies.
     */
    paths?: string[];
  }

  /** A collection this execution may reach, and the folders in it. */
  export interface KnowledgeCollection {
    id: string;
    /** URL-safe name. Either this or `name` may be passed as `collection`. */
    slug: string;
    name: string;
    description: string;
    /**
     * Folders in this collection, `/`-joined, every path spelled out in
     * full — `["invoices", "invoices/2026"]`, not a tree. These are the
     * values `list({ path })` and `search({ path })` take.
     */
    folders: string[];
  }

  /** Where a passage came from. */
  export interface HitDocument {
    id: string;
    name: string;
    collection: string;
    /** Folders it is filed in — how you learn which folder answered. */
    paths: string[];
  }

  /** One passage a search matched. */
  export interface SearchHit {
    /** Pass `hit.document.id` to `open()` when the passage is not enough. */
    document: HitDocument;
    /**
     * Which part of the document this is, as one quotable string — `"p. 4"`,
     * `"Billing > Refunds"`, or `"excerpt 13"`.
     */
    reference: string;
    /** One-based, and only for formats that have pages. */
    page?: number;
    section?: string;
    /**
     * What the hit was ordered by. For ordering only: a reciprocal-rank sum, so
     * gaps between hits mean nothing and values do not compare across queries.
     * No need to threshold on it — a relevance floor is already applied, which
     * is why `hits` can be empty.
     */
    score?: number;
    /** Position within its document. Stable across pages. */
    seq: number;
    content: string;
  }

  /** One page of search results. */
  export interface SearchResults {
    /**
     * In relevance order. Several hits may share a document; empty when nothing
     * was relevant enough to return.
     */
    hits: SearchHit[];
    /** Whether another page exists. Page with `offset + hits.length`. */
    hasMore: boolean;
    /**
     * Set when the search could not be run exactly as asked — today, that a
     * folder was too large to scope up front, so results were ranked across
     * the collection and narrowed after, and recall inside the folder may be
     * lower than it looks. Worth surfacing rather than swallowing.
     */
    note?: string;
  }

  /** One window of a document's text. */
  export interface TextWindow {
    /**
     * Where this window actually starts — not always what was asked for: an
     * offset inside a multi-byte character advances to the next boundary.
     */
    offset: number;
    /** Source bytes consumed. `offset + bytes` is the next offset. */
    bytes: number;
    eof: boolean;
    text: string;
  }

  /** A document you can read from. Obtained from `knowledge.open`. */
  export class Doc implements KnowledgeDocument {
    readonly id: string;
    readonly name: string;
    readonly collection: string;
    readonly bytes?: number;
    readonly pages?: number;
    /** Folders it is filed in. Empty at the collection root. */
    readonly paths: string[];

    /**
     * Read one window — the primitive the rest is built on. Continue from
     * `offset + bytes` of the *reply*, never from what you asked for.
     */
    read(opts?: { offset?: number; length?: number }): Promise<TextWindow>;
    /** Successive windows covering the document, no gaps and no overlap. */
    chunks(opts?: { bytes?: number }): AsyncGenerator<string>;
    /** The document a line at a time. Terminators stripped, `\r\n` handled. */
    lines(opts?: { bytes?: number }): AsyncGenerator<string>;
    /**
     * The whole document as one string. Throws past `maxBytes` (8 MiB by
     * default) — prefer `lines()` / `chunks()` for a single pass.
     */
    text(opts?: { maxBytes?: number }): Promise<string>;
  }

  export class KnowledgeManager {
    /**
     * The collections this execution may reach, and the folders in each.
     * Where a script learns the names `collection` and `path` take, rather
     * than hardcoding a library it may not be granted next time.
     */
    collections(opts?: { collection?: string }): Promise<KnowledgeCollection[]>;
    /** The documents this execution may read. */
    list(opts?: {
      nameContains?: string;
      /** Restrict to one collection, by its name or slug. */
      collection?: string;
      /**
       * Restrict to a folder and everything under it. Matched in every
       * collection in scope that has such a folder.
       */
      path?: string;
      limit?: number;
    }): Promise<KnowledgeDocument[]>;
    /**
     * Find the passages that answer a question, ranked. The counterpart to
     * `read`: reading is for a document you can name, this is for a question
     * whose answer you cannot locate. Billed per query.
     *
     * Empty `hits` is an answer, not a failure: a passage comes back only
     * when the query's words occur in it and it is a close match in meaning,
     * so a question these documents do not answer usually returns nothing
     * rather than the nearest few. Rewording rarely changes it and a larger
     * `limit` never does — the limit is the page size, not a relevance dial.
     * `list()` and `read()` are the cheaper route to a document you can
     * already name.
     */
    search(
      query: string,
      opts?: {
        /** Restrict to one collection, by its name or slug. */
        collection?: string;
        /**
         * Restrict to a folder and everything under it. Resolved to the
         * collection that has it; throws if two in scope do (pass
         * `collection` as well), and is empty — not an error — if none
         * does.
         */
        path?: string;
        /** 1-25; 8 by default. */
        limit?: number;
        offset?: number;
      },
    ): Promise<SearchResults>;
    /**
     * Open by name or id. Throws, naming what is reachable, if there is none —
     * and throws if the name matches documents in several collections, since
     * names are unique only within one. Pass `{ collection }` to choose, or
     * qualify the name with its folder: `open("policies/2026/leave.pdf")`.
     */
    open(reference: string, opts?: { collection?: string }): Promise<Doc>;
    /** `open`, but `null` for an absence. Still throws on an ambiguous name. */
    find(reference: string, opts?: { collection?: string }): Promise<Doc | null>;
  }

  /** Process-wide singleton. */
  export const knowledge: KnowledgeManager;
}

declare module "urai:chat" {
  /**
   * A file travelling with a request. A bare string is always a **file id**
   * from `files.upload` — never a data URL.
   */
  export type Attachment =
      | string
      | { fileId: string }
      | {
            /** Raw bytes, a `data:` URL, or bare base64. */
            data: Uint8Array | ArrayBuffer | Blob | string;
            /** Shown to the model. Derived from the mime type when omitted. */
            filename?: string;
            /** Guessed from `filename` when omitted. */
            mimeType?: string;
        };
  /** OpenAI's content-part shapes, for hand-built multimodal messages. */
  export type ChatContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: string } }
      | {
            type: "file";
            file: { file_id?: string; file_data?: string; filename?: string };
        };
  /** `"provider/model"`, e.g. `"anthropic/claude-sonnet-5"`. */
  export interface ChatMessage {
      role: "system" | "user" | "assistant";
      content: string | ChatContentPart[];
      /** Files for this turn. User messages only — anywhere else throws. */
      attachments?: Attachment[];
  }
  /**
   * Whether the model may call a tool. The named form pins one call, and the
   * name there is a *function* name — naming a tool exposes each of its
   * functions to the model individually.
   */
  export type ToolChoice =
      | "none"
      | "auto"
      | "required"
      | { type: "function"; function: { name: string } };
  export interface ChatOptions {
      model: string;
      messages: ChatMessage[];
      temperature?: number;
      maxTokens?: number;
      responseFormat?: unknown;
      /**
       * uraijs tools the model may call, by catalog name. Naming a tool
       * exposes every function it declares; schemas come from the host.
       *
       * Calls run host-side until the model stops asking, so the response is
       * the finished answer — no tool-call loop to write here. An unknown
       * name is an error, not a silent omission.
       */
      tools?: string[];
      /** Whether the model may or must call one. Only meaningful with `tools`. */
      toolChoice?: ToolChoice;
      /** Files for the **last user message**. Max 16 per request, 25 MiB each. */
      attachments?: Attachment[];
  }
  export interface ExtractOptions {
      /** JSON Schema describing the object you want back. */
      schema: Record<string, unknown>;
      /** The text to extract from. Optional when `attachments` carry the source. */
      input?: string;
      /** Files to extract from — a PDF, a scan, a spreadsheet. */
      attachments?: Attachment[];
      model: string;
      /** Schema name. Letters, digits, `-` and `_` only. */
      name?: string;
      instructions?: string;
      temperature?: number;
  }
  /** A file held by the host. */
  export interface UraiFile {
      id: string;
      object: "file";
      bytes: number;
      /** Unix seconds. */
      created_at: number;
      filename: string;
      purpose: string;
      mime_type: string;
  }
  export interface UploadOptions {
      /** Raw bytes, a `data:` URL, or bare base64. */
      data: Uint8Array | ArrayBuffer | Blob | string;
      filename: string;
      mimeType?: string;
      purpose?: string;
  }
  /** Raw completion against the host's chat API. Returns the OpenAI-shaped body. */
  export function chat(opts: ChatOptions): Promise<any>;
  /**
   * Pull a structured object out of text, constrained by a JSON Schema.
   * Retries once on unparseable JSON, then throws.
   *
   * Network call: use inside `Step.run` only, never in a `Workflow.run`
   * coordinator body (which re-executes on every tick).
   */
  export function extract<T = unknown>(opts: ExtractOptions): Promise<T>;
  /**
   * Upload once, reference by id afterwards — worth it whenever the same bytes
   * are used more than once. Files are scoped to the current run.
   *
   * Network calls: `Step.run` only. A file id is durable state, so upload
   * inside a step and return the id; a step that re-runs uploads again and
   * gets a new one.
   */
  export const files: {
      upload(opts: UploadOptions): Promise<UraiFile>;
      list(): Promise<UraiFile[]>;
      get(id: string): Promise<UraiFile>;
      content(id: string): Promise<Uint8Array>;
      delete(id: string): Promise<boolean>;
  };
}

// Org library imports (urai:lib/<org>/<name>) resolve at runtime and via
// urai.toml overrides; typed as `any` for the editor.
declare module "urai:lib/*";
