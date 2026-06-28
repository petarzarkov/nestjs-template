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

Add the variable to the appropriate config DTO:

- Pick the matching group (`service-vars.dto.ts`, `db-vars.dto.ts`,
  `redis-vars.dto.ts`, `oauth-vars.dto.ts`, `ai-vars.dto.ts`, `aws-vars.dto.ts`,
  `stripe-vars.dto.ts`, `ws-vars.dto.ts`). Create a new DTO only for a genuinely
  new concern.
- Add the class-validator decorators:
  - Required: the type decorator (`@IsString()`, `@IsNumber()`, `@IsEnum(...)`,
    `@IsUrl()`, …) with no `@IsOptional()`. The `!` non-null assertion marks it
    required (e.g. `JWT_SECRET!: string`).
  - Optional / defaulted: add `@IsOptional()` plus the type decorator, and give
    it a default (e.g. `HTTP_REQ_TIMEOUT: number = 30000`).
  - Use `@Transform(...)` for parsing (comma-lists, numbers, booleans).
- If the value should be exposed to the app, map it in that DTO's
  `getXConfig(...)` function (e.g. `getServiceConfig`, `getStripeConfig`) so it
  surfaces under the typed `AppConfigService` config tree.
- If you created a **new** DTO, add it to the `IntersectionType(...)` in
  [`src/config/env-vars.dto.ts`](../../src/config/env-vars.dto.ts) and wire its
  `getXConfig` into [`src/config/env.validation.ts`](../../src/config/env.validation.ts).

### Step 4 — Regenerate docs

Run:

```
bun run gen:env:docs
```

This regenerates `env-vars.md` at the repo root from the config DTOs.

After all steps, confirm what was changed and remind the user to restart the app
(`bun dev`) to pick up the new variable.
