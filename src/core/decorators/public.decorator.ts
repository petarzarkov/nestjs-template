/**
 * Marks a route as public — bypasses the global Better Auth `AuthGuard`.
 * Thin alias over `@thallesp/nestjs-better-auth`'s `AllowAnonymous` so existing
 * `@Public()` usages keep working.
 */
export { AllowAnonymous as Public } from '@thallesp/nestjs-better-auth';
