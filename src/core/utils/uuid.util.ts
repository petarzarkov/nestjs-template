/**
 * Canonical UUID string matcher — replaces the `uuid` package's `validate`.
 * Generation uses the native `crypto.randomUUID()` directly (see columns.ts,
 * request.middleware.ts, events.gateway.ts).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `value` is a canonically-formatted UUID string. */
export const isUuid = (value: string): boolean => UUID_REGEX.test(value);
