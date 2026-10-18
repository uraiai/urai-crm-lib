# Agent guide: urai-crm-lib (Urai library)

This project is a **Urai library** — a reusable TypeScript module shared across an
org's tools and workflows. It runs in the **UraiJS runtime, a sandboxed
JavaScript/TypeScript runtime (NOT Node.js)**. Author it with the `uraijs` CLI
and deploy by `git push` to the Urai
libraries remote. Consumers import it as `urai:lib/<org>/urai-crm-lib`.

## Runtime constraints — read before writing code

- **Not Node.js.** No `require`, no Node built-ins (`fs`, `path`, `process`, …),
  no filesystem or process access.
- **Available globals:** `fetch`, `WebSocket`, `console`, `URL`, `crypto`,
  timers, standard ESNext — web-platform APIs.
- **Imports:** npm (bare / `npm:…`), `https://…`, other `urai:lib/<org>/<name>`,
  and `urai:secrets`. Keep dependencies free of Node built-ins.
- Prefer pure functions; if you touch secrets, use
  `import { secrets } from "urai:secrets"; await secrets.get("KEY")`. Never
  hardcode secrets.

## Authoring

- Just a normal ES module: `export` functions/values from `index.ts`.
- `index.ts` (index) is the entry: `import { thing } from "urai:lib/<org>/urai-crm-lib"`
  resolves here; `urai:lib/<org>/urai-crm-lib/sub` resolves `./sub`.
- No `@tool`, no `declarations.ts`, no schema — libraries export code, they don't
  declare tools.

```ts
/** A pure helper, importable from tools/workflows. */
export function shout(s: string): string {
  return s.toUpperCase() + "!";
}
```

## The `uraijs` CLI

| Command | Purpose |
|---|---|
| `uraijs types` | Refresh `urai.d.ts` + `tsconfig.json` (editor types) |
| `uraijs eval <file.ts>` | One-shot run of a script that imports this lib |

Add `--json` for machine-readable stdout.

**Developing against a consuming tool:** in the tool's project, run
`uraijs lib link <org>/urai-crm-lib ../path-to-this-lib` so its `urai:lib/<org>/urai-crm-lib`
imports resolve to this local checkout (via that project's `urai.toml`).

## Files

- `index.ts` — the library's exports (CRM reads/writes + `show*` helpers).
- `client.ts` — the HTTP client: bearer `meta.vars.session_token` against
  `meta.vars.crm_api_url`; throws `CrmError` with the API's message.
- `types.ts` — CRM enums and record types, mirroring `app/lib/*` in the CRM
  repo. Keep them in sync.
- `ui.ts` — `sendCommand` helpers the CRM page understands (displayComponent,
  navigate, refresh). The page validates these in `app/lib/assistant.ts`.
- `AGENT.md` — the reference injected into the agent's prompt. Update it with
  every export change.
- `prompts/agent.md` — the agent's instructions; paste into the Urai console.
- `urai.d.ts` / `tsconfig.json` — editor types (generated; `uraijs types`).
- `urai.toml` — project manifest.
