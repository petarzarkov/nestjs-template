import { z } from 'zod';

const csvOf = <T extends string>(fallback: T[]) =>
  z
    .string()
    .optional()
    .transform(value =>
      typeof value === 'string'
        ? (value.split(',').map(v => v.trim()) as T[])
        : fallback,
    );

export const wsVarsSchema = z.object({
  WS_CONNECT_TIMEOUT: z.coerce.number().default(50000),
  WS_PING_INTERVAL: z.coerce.number().default(25000),
  WS_PING_TIMEOUT: z.coerce.number().default(5000),
  WS_CLEANUP_EMPTY_CHILD_NAMESPACES: z.stringbool().default(true),
  WS_PATH: z.string().default('/ws'),
  WS_PORT: z.coerce.number().optional(),
  WS_TRANSPORTS: csvOf<'websocket' | 'polling'>(['websocket']),
});

export type WsVars = z.infer<typeof wsVarsSchema>;
