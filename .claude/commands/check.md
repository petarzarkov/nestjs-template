---
description: Run the four post-implementation quality gates (lint, test, build, typecheck) and report results.
---

Run the four quality gates **in order**, stopping only if a gate exits non-zero (but always report the final status of each):

```
bun run lint
bun test
bun run build
bun run typecheck
```

For each gate:

- If it **passes** → note it and continue.
- If it **fails** → show the relevant error output, then stop and tell the user what needs fixing. Do NOT auto-fix unless the user asks.

After all gates pass (or after reporting the first failure), give a one-line summary:
`✓ lint  ✓ test  ✓ build  ✓ typecheck` (or mark failing ones with `✗`).
