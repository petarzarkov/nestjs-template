/**
 * Compile-time type assertions (no runtime output).
 *
 * Used to guard hand-written Swagger `entity/*.ts` classes against silent drift
 * from their Drizzle row type: `type _Drift = Expect<Equal<Entity, Row>>;`
 * fails `tsc` if a column is added/removed/retyped without updating the entity.
 */
export type Expect<T extends true> = T;

export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
