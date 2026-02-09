export const AUDITABLE_KEY = 'AUDITABLE_METADATA';

export interface AuditableOptions {
  /** Fields to exclude from audit logs (e.g., 'password') */
  exclude?: string[];
}

export function Auditable(options: AuditableOptions = {}): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(AUDITABLE_KEY, options, target);
  };
}
