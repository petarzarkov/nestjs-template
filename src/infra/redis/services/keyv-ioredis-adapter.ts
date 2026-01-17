import type { Redis } from 'ioredis';

/**
 * A simple adapter that makes an ioredis instance compatible with Keyv's store interface.
 * This is used by the cache-manager library.
 */
export class KeyvIoredisAdapter {
  private readonly prefix = 'keyv:';
  constructor(private readonly redis: Redis) {}

  #getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<string | undefined> {
    const value = await this.redis.get(this.#getKey(key));
    return value ?? undefined;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(this.#getKey(key), value, 'PX', ttl);
    } else {
      await this.redis.set(this.#getKey(key), value);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.redis.del(this.#getKey(key));
    return result > 0;
  }

  async clear(): Promise<void> {
    const stream = this.redis.scanStream({
      match: `${this.prefix}*`,
      count: 100,
    });

    return new Promise((resolve, reject) => {
      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          stream.pause(); // Pause to prevent overwhelming the command queue
          try {
            await this.redis.del(...keys);
            stream.resume();
          } catch (err) {
            stream.destroy();
            reject(err);
          }
        }
      });

      stream.on('end', () => resolve());
      stream.on('error', err => reject(err));
    });
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this.#getKey(key));
    return exists > 0;
  }
}
