import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, openAPI } from 'better-auth/plugins';
import type { Redis } from 'ioredis';
import type { DrizzleDB } from '@/infra/db/client';
import { accounts, sessions, users, verifications } from '@/infra/db/schema';
import { EVENTS } from '@/notifications/events/events';
import type { JobPublisherService } from '@/infra/queue/services/job-publisher.service';

export interface BuildAuthDeps {
  db: DrizzleDB;
  secret: string;
  /** Full origin, e.g. http://localhost:3011 */
  baseURL: string;
  trustedOrigins: string[];
  /** Session lifetime in seconds. */
  sessionExpiresIn: number;
  /**
   * When present, sessions/verification data live in Redis via
   * `secondaryStorage`. Omitted in CLI scripts (fall back to the DB tables).
   */
  redis?: Redis;
  oauth?: {
    google?: { clientId: string; clientSecret: string };
    github?: { clientId: string; clientSecret: string };
    linkedin?: { clientId: string; clientSecret: string };
  };
  /**
   * Reuses the notification queue so emails + WS notifications keep flowing.
   * Omitted in CLI scripts (no welcome email / reset-password on seed).
   */
  jobPublisher?: JobPublisherService;
}

/**
 * Builds the Better Auth instance. Stateful sessions (stored in Redis via
 * `secondaryStorage`, cached in a signed cookie), email/password + social
 * (google/github/linkedin), the `admin` plugin (role/ban) and the `bearer`
 * plugin (so WS / CMS / e2e / mobile clients authenticate with
 * `Authorization: Bearer <sessionToken>` instead of cookies).
 *
 * The app uses Better Auth's native `name`/`image` field names throughout, so
 * the session user and a selected row share one `SanitizedUser` shape. IDs are
 * UUIDs so existing FKs hold.
 */
export const buildAuth = (deps: BuildAuthDeps) => {
  const { db, redis, oauth, jobPublisher } = deps;

  return betterAuth({
    secret: deps.secret,
    baseURL: deps.baseURL,
    basePath: '/api/auth',
    trustedOrigins: deps.trustedOrigins,

    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),

    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 64,
      ...(jobPublisher && {
        sendResetPassword: async ({ user, token }) => {
          await jobPublisher.publishJob(
            EVENTS.ROUTING_KEYS.USER_PASSWORD_RESET,
            {
              userId: user.id,
              email: user.email,
              name: user.name || user.email,
              resetToken: token,
            },
          );
        },
      }),
    },

    ...(oauth && {
      socialProviders: {
        ...(oauth.google && { google: oauth.google }),
        ...(oauth.github && { github: oauth.github }),
        ...(oauth.linkedin && { linkedin: oauth.linkedin }),
      },
    }),

    session: {
      expiresIn: deps.sessionExpiresIn,
      cookieCache: { enabled: true, maxAge: 300 },
    },

    // Sessions / verification / rate-limit data live in Redis, not SQLite.
    ...(redis && {
      secondaryStorage: {
        get: (key: string) => redis.get(key),
        set: (key: string, value: string, ttl?: number) =>
          ttl
            ? redis.set(key, value, 'EX', ttl).then(() => undefined)
            : redis.set(key, value).then(() => undefined),
        delete: (key: string) => redis.del(key).then(() => undefined),
      },
    }),

    ...(jobPublisher && {
      databaseHooks: {
        user: {
          create: {
            after: async (user: {
              id: string;
              email: string;
              name: string;
            }) => {
              await jobPublisher.publishJob(
                EVENTS.ROUTING_KEYS.USER_REGISTERED,
                {
                  email: user.email,
                  name: user.name || user.email,
                  type: 'direct',
                },
                { emitToAdmins: true, queue: EVENTS.QUEUES.BACKGROUND_JOBS },
              );
            },
          },
        },
      },
    }),

    // `openAPI()` exposes `auth.api.generateOpenAPISchema()` so the Better Auth
    // routes can be merged into the app's Swagger document (see setupDocs). The
    // plugin's own Scalar page is disabled — we surface everything in /api/docs.
    plugins: [admin(), bearer(), openAPI({ disableDefaultReference: true })],
  });
};

export type Auth = ReturnType<typeof buildAuth>;

/**
 * Minimal Better Auth instance for CLI scripts (seeders, `create:admin`). No
 * Redis secondary storage and no queue hooks — just enough to create accounts
 * with correct scrypt hashing + `account` rows. Reads the secret/URL from env.
 */
export const buildStandaloneAuth = (db: DrizzleDB): Auth =>
  buildAuth({
    db,
    secret:
      process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-please-32ch',
    baseURL: process.env.APP_URL ?? 'http://localhost:3011',
    trustedOrigins: [],
    sessionExpiresIn: 604800,
  });
