import type { Redis } from 'ioredis';
import type { KeyvStoreAdapter, StoredData } from 'keyv';

export class KeyvIoredisAdapter implements KeyvStoreAdapter {
  namespace?: string;
  ttlSupport = true;
  opts: Record<string, unknown> = { url: 'ioredis://' };

  constructor(
    private readonly client: Redis,
    options?: { namespace?: string },
  ) {
    this.namespace = options?.namespace;
    this.opts = { url: 'ioredis://', ...options };
  }

  private _getKeyName(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    const fullKey = this._getKeyName(key);
    const value = await this.client.get(fullKey);

    if (value === null) {
      return undefined;
    }

    try {
      return JSON.parse(value);
    } catch {
      return { value: value as Value };
    }
  }

  async getMany<Value>(
    keys: string[],
  ): Promise<Array<StoredData<Value | undefined>>> {
    if (keys.length === 0) {
      return [];
    }

    const fullKeys = keys.map(k => this._getKeyName(k));
    const values = await this.client.mget(...fullKeys);

    return values.map(value => {
      if (value === null) {
        return { value: undefined };
      }

      try {
        return JSON.parse(value);
      } catch {
        return { value: value as Value };
      }
    });
  }

  async set<Value>(
    key: string,
    value: StoredData<Value>,
    ttl?: number,
  ): Promise<void> {
    const fullKey = this._getKeyName(key);
    const serialized = JSON.stringify(value);

    if (ttl && ttl > 0) {
      await this.client.set(fullKey, serialized, 'PX', ttl);
    } else {
      await this.client.set(fullKey, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this._getKeyName(key);
    const result = await this.client.del(fullKey);
    return result > 0;
  }

  async deleteMany(keys: string[]): Promise<boolean> {
    if (keys.length === 0) {
      return true;
    }

    const fullKeys = keys.map(k => this._getKeyName(k));
    const result = await this.client.del(...fullKeys);
    return result > 0;
  }

  async clear(): Promise<void> {
    if (this.namespace) {
      const pattern = `${this.namespace}:*`;
      const stream = this.client.scanStream({ match: pattern, count: 100 });

      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          // Pipeline deletes for performance
          const pipeline = this.client.pipeline();
          for (const key of keys) {
            pipeline.del(key);
          }
          await pipeline.exec();
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } else {
      await this.client.flushdb();
    }
  }

  async has(key: string): Promise<boolean> {
    const fullKey = this._getKeyName(key);
    const result = await this.client.exists(fullKey);
    return result === 1;
  }

  async disconnect(): Promise<void> {
    // Don't disconnect - this is a shared client
    // The RedisService will handle disconnection
  }

  on(_event: string, _listener: (...args: unknown[]) => void): this {
    // Event emitter stub - not used in this implementation
    return this;
  }
}
