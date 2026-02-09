import { Injectable } from '@nestjs/common';
import {
  DataSource,
  type EntityMetadata,
  type EntitySubscriberInterface,
  EventSubscriber,
  type InsertEvent,
  type RemoveEvent,
  type UpdateEvent,
} from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import {
  AUDITABLE_KEY,
  type AuditableOptions,
} from '@/core/decorators/auditable.decorator';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { AuditLog } from '../entity/audit-log.entity';
import { AuditAction } from '../enum/audit-action.enum';

type EntityClass = new (...args: never) => unknown;

interface AuditValues {
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private readonly optionsCache = new WeakMap<
    EntityClass,
    AuditableOptions | null
  >();

  constructor(
    dataSource: DataSource,
    private readonly contextService: ContextService,
    private readonly logger: ContextLogger,
  ) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    if (!this.shouldAudit(event.metadata?.target as EntityClass)) return;
    await this.handleAudit(event, AuditAction.INSERT);
  }

  async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    if (!this.shouldAudit(event.metadata?.target as EntityClass)) return;
    await this.handleAudit(event, AuditAction.UPDATE);
  }

  async afterRemove(event: RemoveEvent<unknown>): Promise<void> {
    if (!this.shouldAudit(event.metadata?.target as EntityClass)) return;
    await this.handleAudit(event, AuditAction.DELETE);
  }

  private shouldAudit(entityClass: EntityClass | undefined): boolean {
    if (!entityClass || typeof entityClass !== 'function') return false;
    if (entityClass === AuditLog) return false;
    return this.getAuditableOptions(entityClass) !== null;
  }

  private getAuditableOptions(
    entityClass: EntityClass,
  ): AuditableOptions | null {
    if (this.optionsCache.has(entityClass)) {
      return this.optionsCache.get(entityClass) ?? null;
    }
    const options = Reflect.getMetadata(AUDITABLE_KEY, entityClass);
    const result = options ?? null;
    this.optionsCache.set(entityClass, result);
    return result;
  }

  private getEntityId(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
  ): string {
    const primaryColumns = metadata.primaryColumns;
    if (primaryColumns.length === 1) {
      return String(entity[primaryColumns[0].propertyName]);
    }
    return primaryColumns.map(col => entity[col.propertyName]).join('_');
  }

  private getActorId(): string | null {
    try {
      const context = this.contextService.getContext();
      return context?.userId ? String(context.userId) : null;
    } catch {
      return null;
    }
  }

  private cleanValue(
    obj: Record<string, unknown>,
    exclude: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (!exclude.includes(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  private areValuesEqual(val1: unknown, val2: unknown): boolean {
    if (val1 === val2) return true;
    if (val1 == null || val2 == null) return false;

    if (val1 instanceof Date && val2 instanceof Date) {
      return val1.getTime() === val2.getTime();
    }

    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return JSON.stringify(val1) === JSON.stringify(val2);
    }

    return false;
  }

  private getDiff(
    oldEntity: Record<string, unknown> | undefined,
    newEntity: Record<string, unknown> | undefined,
    updatedColumns: ColumnMetadata[],
    exclude: string[],
  ): {
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  } | null {
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    let hasChanges = false;

    const keysToCheck =
      updatedColumns.length > 0
        ? updatedColumns.map(c => c.propertyName)
        : [
            ...new Set([
              ...Object.keys(oldEntity ?? {}),
              ...Object.keys(newEntity ?? {}),
            ]),
          ];

    for (const key of keysToCheck) {
      if (exclude.includes(key)) continue;
      if (['createdAt', 'updatedAt', 'deletedAt', 'version'].includes(key))
        continue;

      const oldVal = oldEntity?.[key];
      const newVal = newEntity?.[key];

      if (!this.areValuesEqual(oldVal, newVal)) {
        oldValue[key] = oldVal;
        newValue[key] = newVal;
        hasChanges = true;
      }
    }

    return hasChanges ? { oldValue, newValue } : null;
  }

  private async handleAudit(
    event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>,
    action: AuditAction,
  ): Promise<void> {
    try {
      const entityClass = event.metadata.target as EntityClass;
      const options = this.getAuditableOptions(entityClass);
      const exclude = options?.exclude ?? [];
      const metadata = event.metadata;

      let values: AuditValues | null = null;

      if (action === AuditAction.INSERT) {
        const entity = event.entity as Record<string, unknown>;
        if (!entity) return;
        values = {
          entityId: this.getEntityId(entity, metadata),
          oldValue: null,
          newValue: this.cleanValue(entity, exclude),
        };
      } else if (action === AuditAction.UPDATE) {
        const updateEvent = event as UpdateEvent<unknown>;
        const newEntity = updateEvent.entity as
          | Record<string, unknown>
          | undefined;
        const oldEntity = updateEvent.databaseEntity as
          | Record<string, unknown>
          | undefined;

        if (!newEntity && !oldEntity) return;

        const diff = this.getDiff(
          oldEntity,
          newEntity,
          updateEvent.updatedColumns ?? [],
          exclude,
        );
        if (!diff) return;

        const refEntity = (newEntity ?? oldEntity) as Record<string, unknown>;
        values = {
          entityId: this.getEntityId(refEntity, metadata),
          oldValue: diff.oldValue,
          newValue: diff.newValue,
        };
      } else {
        const entity = (event as RemoveEvent<unknown>).databaseEntity as
          | Record<string, unknown>
          | undefined;
        if (!entity) return;
        values = {
          entityId: this.getEntityId(entity, metadata),
          oldValue: this.cleanValue(entity, exclude),
          newValue: null,
        };
      }

      if (!values) return;

      const auditLog = new AuditLog();
      auditLog.actorId = this.getActorId();
      auditLog.action = action;
      auditLog.entityName = metadata.name;
      auditLog.entityId = values.entityId;
      auditLog.oldValue = values.oldValue;
      auditLog.newValue = values.newValue;

      if (event.queryRunner?.manager) {
        await event.queryRunner.manager.save(AuditLog, auditLog);
      }
    } catch (error) {
      this.logger.error(
        `Audit failed for ${action} on ${event.metadata?.name}`,
        { error },
      );
    }
  }
}
