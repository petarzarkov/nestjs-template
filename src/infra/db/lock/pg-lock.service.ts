import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';

/**
 * Service for managing PostgreSQL advisory locks.
 *
 * Use this service to ensure that a specific critical operation or code block
 * is executed by only one "master" instance across multiple running application instances
 * (e.g., in a distributed microservices environment or horizontally scaled applications).
 * It prevents race conditions for shared resources or to elect a single leader for tasks
 * like cron jobs or message processing.
 */
@Injectable()
export class PgLockService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: ContextLogger,
  ) {}

  async withLock<T>(
    operation: string,
    callback: (manager: EntityManager) => Promise<T> | T,
    manager?: EntityManager,
  ): Promise<T | 'not_locked'> {
    const useExistingTransaction = !!manager;
    let queryRunner: ReturnType<
      typeof this.entityManager.connection.createQueryRunner
    > | null = null;

    try {
      if (!useExistingTransaction) {
        queryRunner = this.entityManager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
      }
      const managerToUse = manager || (queryRunner?.manager as EntityManager);
      const bigIntLockKey = this.#getPgAdvisoryLockBigInt(operation);
      // pg_try_advisory_xact_lock attempts to acquire the lock and returns a boolean.
      // It's non-blocking within the transaction.
      // The lock will be released automatically on commiting or rolling back the transaction.
      const lockAcquiredResult = await managerToUse.query(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [bigIntLockKey],
      );
      const locked: boolean = lockAcquiredResult[0].locked;

      if (!locked) {
        this.logger.warn(
          `Failed to acquire lock with key: ${operation}. Another process holds it.`,
        );
        if (!useExistingTransaction && queryRunner) {
          await queryRunner.rollbackTransaction();
        }
        return 'not_locked';
      }

      this.logger.verbose(
        `DB lock for ${operation} acquired. Executing callback...`,
      );
      const result = await callback(managerToUse);
      this.logger.verbose(
        `DB lock ${operation} callback executed${useExistingTransaction ? '' : '. Committing transaction...'}`,
      );

      if (!useExistingTransaction && queryRunner) {
        await queryRunner.commitTransaction();
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Error within lock ${operation}: ${JSON.stringify(error)}`,
      );
      if (!useExistingTransaction && queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!useExistingTransaction && queryRunner) {
        await queryRunner.release();
        this.logger.verbose(`DB lock ${operation} released.`);
      }
    }
  }

  /**
   * Generates a BigInt from a string using a cryptographic hash,
   * ensuring it fits within PostgreSQL's signed 64-bit BIGINT range.
   *
   * PostgreSQL BIGINT range:
   *
   * `-9,223,372,036,854,775,808` to `9,223,372,036,854,775,807`
   *
   * This is equivalent to -(2^63) to (2^63 - 1).
   */
  #getPgAdvisoryLockBigInt(operation: string): bigint {
    const hashBuffer = createHash('sha256').update(operation).digest();
    const eightBytes = hashBuffer.subarray(0, 8);
    const lockBigInt = eightBytes.readBigInt64BE(0);

    return lockBigInt;
  }
}
