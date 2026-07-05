/**
 * Central Drizzle schema barrel — re-exports every table so the drizzle
 * instance (relational queries) and drizzle-kit (push/generate) see them all.
 */
export * from '@/users/schema/user.schema';
export * from '@/users/schema/password-reset-token.schema';
export * from '@/auth/schema/auth-provider.schema';
export * from '@/users/invites/schema/invite.schema';
export * from '@/audit/schema/audit-log.schema';
export * from '@/file/schema/file.schema';
