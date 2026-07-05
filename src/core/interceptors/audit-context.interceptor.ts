import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Observable } from 'rxjs';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';

/**
 * Publishes the current authenticated user into the `_audit_ctx` row so the
 * SQLite audit triggers can attribute changes. Best-effort under concurrent
 * async requests (single shared SQLite connection) — see `db/triggers.ts`.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context
        .switchToHttp()
        .getRequest<{ user?: { id?: string } }>();
      const actorId = request.user?.id ?? null;
      this.db.run(
        sql`UPDATE _audit_ctx SET actor_id = ${actorId} WHERE id = 1`,
      );
    }
    return next.handle();
  }
}
