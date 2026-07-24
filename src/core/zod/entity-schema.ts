import { z } from 'zod';

/** OpenAPI representation for `Date` columns (a `string` with `date-time`). */
const dateTimeJsonSchema = () => ({ type: 'string', format: 'date-time' });

interface ZodNode {
  _zod: {
    def: { type?: string; innerType?: ZodNode };
    toJSONSchema?: () => unknown;
  };
}

/**
 * Post-processes a `drizzle-zod` select schema so its `z.date()` columns render
 * as `string` / `date-time` in the OpenAPI document.
 *
 * Zod v4 marks `Date` as unrepresentable in JSON Schema, and nestjs-zod calls
 * `toJSONSchema(..., unrepresentable: 'throw')`, so any `z.date()` DTO crashes
 * Swagger generation at boot (`Date cannot be represented in JSON Schema` —
 * nestjs/swagger#3672). Zod's `process()` honours a per-instance
 * `_zod.toJSONSchema` override *before* the throwing processor runs, so we set
 * one on each date node (unwrapping `nullable`/`optional`). The runtime type
 * stays `Date`; only the documented JSON shape changes.
 */
export function withDateFormat<T extends z.ZodObject>(schema: T): T {
  for (const field of Object.values(schema.shape)) {
    let node = field as unknown as ZodNode;
    while (node._zod.def.innerType) {
      node = node._zod.def.innerType;
    }
    if (node._zod.def.type === 'date') {
      node._zod.toJSONSchema = dateTimeJsonSchema;
    }
  }
  return schema;
}
