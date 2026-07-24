---
description: Add a new environment variable following the project's env var protocol.
---

The user will specify the variable name, type, and purpose.
If any of these are missing, ask before proceeding.

Follow the steps **in order**:

### Step 1 — `.env.example`

Add the variable with a placeholder value and a short inline comment:

```
VAR_NAME=placeholder   # <one-line purpose>
```

### Step 2 — `.env`

Add the variable with a sensible local-dev default (never a production secret).

### Step 3 — Validation DTO (`src/config/dto/`)

Config is **Zod**, not class-validator. Each DTO exports a `z.object({...})`
schema plus a `getXConfig(config)` mapper.

- Pick the matching group (`service-vars.dto.ts`, `db-vars.dto.ts`,
  `redis-vars.dto.ts`, `oauth-vars.dto.ts`, `ai-vars.dto.ts`, `aws-vars.dto.ts`,
  `ws-vars.dto.ts`). Create a new DTO only for a genuinely new concern.
- Add the field to that file's `xVarsSchema = z.object({ ... })`. Env values are
  strings, so coerce non-strings:
  - Required: `VAR_NAME: z.string()` (or `z.url()`, `z.enum(MyEnum)`).
  - Number: `z.coerce.number()` (e.g. `z.coerce.number().default(30000)`).
  - Boolean: `z.stringbool()`.
  - Optional / defaulted: add `.optional()` or `.default(...)`.
- Surface it to the app by mapping it in that DTO's `getXConfig(config)`
  function (e.g. `getServiceConfig`, `getAIConfig`) so it appears under the typed
  `AppConfigService` config tree.
- Cross-field rules ("required when X") go in the `.superRefine(...)` in
  [`src/config/env-vars.dto.ts`](../../src/config/env-vars.dto.ts).
- If you created a **new** DTO: spread its `.shape` into `envSchema` in
  [`src/config/env-vars.dto.ts`](../../src/config/env-vars.dto.ts) and wire its
  `getXConfig` into the config object returned by
  [`src/config/env.validation.ts`](../../src/config/env.validation.ts).

### Step 4 — Regenerate docs

Run:

```
bun run gen:env:docs
```

This regenerates `env-vars.md` at the repo root from the config DTOs.

After all steps, confirm what was changed and remind the user to restart the app
(`bun dev`) to pick up the new variable.
