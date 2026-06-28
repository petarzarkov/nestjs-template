---
description: Write unit and/or e2e tests for a given service or module, following this project's Bun-test conventions.
---

The user will name the target (e.g. `/write-tests FileService`).
If not specified, ask which service/module to test.

### Determine what to write

Ask (or infer from context) whether to write:

- **Unit tests** (`<name>.spec.ts`, next to the source file) — all deps mocked,
  tests service logic in isolation. Run with `bun test`.
- **E2E tests** (`e2e/<feature>/<feature>.e2e.spec.ts`) — real running app +
  Postgres via the shared test context, exercises HTTP/WS end-to-end. Run with
  `bun run test:e2e`.
- **Both**.

### Rules for unit tests (`<name>.spec.ts`)

- Import test primitives from `bun:test`: `describe`, `it` (or `test`),
  `expect`, `beforeEach`, `afterEach`, `mock`. There is **no** `@jest/globals`
  and **no** `jest` global in this repo.
- Bootstrap the provider graph with `@nestjs/testing`:
  `import { Test, TestingModule } from '@nestjs/testing'` →
  `await Test.createTestingModule({ providers: [...] }).compile()`.
- Mock every dependency with `mock(() => undefined)` from `bun:test`, provided
  via `{ provide: SomeService, useValue: { method: mock(...) } }`. Retrieve them
  back with `module.get(SomeService)` so you can assert on calls.
- Always provide a mock `ContextLogger`
  (`@arkv/nestjs-context-logger`) — most services inject it.
- Reset mock call history in `afterEach` with `.mockClear()`
  (cast as `ReturnType<typeof mock>` when TS needs it). Never share mutable state
  between tests.
- Drive behaviour with `.mockResolvedValue(...)`, `.mockResolvedValueOnce(...)`,
  `.mockReturnValue(...)`, etc. Assert with `toHaveBeenCalledWith(...)`,
  `expect(...).rejects.toThrow(...)` for error paths.
- See [`src/file/services/file.service.spec.ts`](../../src/file/services/file.service.spec.ts)
  as the reference example.
- The unit test file lives **next to** the source file (`foo.service.ts` →
  `foo.service.spec.ts`).

### Rules for e2e tests (`e2e/<feature>/<feature>.e2e.spec.ts`)

- Import primitives from `bun:test` (`describe`, `test`, `expect`, `afterEach`).
- Use the shared singleton context:
  `import { getTestContext } from '../setup/context'` →
  `const ctx = getTestContext()`. It exposes:
  - `ctx.api` — HTTP client (`get`/`post`/...), typed via generics
  - `ctx.db` — direct DB access for setup/teardown
  - `ctx.ws` — Socket.io client
  - `ctx.loginAsAdmin()` — authenticate as the seeded admin
  - `ctx.reset()` — clear auth token + disconnect WS (call in `afterEach`)
- Respect the rate limiter: the short throttle is 10 req/1s, so add
  `await Bun.sleep(1100)` at the start of throttle-sensitive tests (see
  [`e2e/users/users.e2e.spec.ts`](../../e2e/users/users.e2e.spec.ts)).
- Clean up any rows you create (delete dependent `auditLogs` first, then the
  entity) via `ctx.db`.
- Paginated endpoints follow the cursor-pagination contract — assert on
  `data` + `meta` (`take`, `hasNextPage`, `hasPreviousPage`, `nextCursor`,
  `previousCursor`).

### General rules

- Test **services**, not controllers or gateways (controllers stay thin).
- Cover: happy path, error/exception paths (`NotFoundException`,
  `BadRequestException`, etc.), and edge cases.
- Don't write tests for migrations or scripts.
- After writing, confirm they pass:
  - Unit: `bun test <path/to/file.spec.ts>`
  - E2E: `bun run test:e2e:single ./e2e/<feature>/<feature>.e2e.spec.ts`
