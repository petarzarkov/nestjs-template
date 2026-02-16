import { BadRequestException } from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';

export interface CursorPayload {
  /** Sort column value (ISO 8601 date string or stringified value) */
  s: string;
  /** Entity UUID */
  i: string;
}

export function encodeCursor(sortValue: Date | string, id: string): string {
  const payload: CursorPayload = {
    s: sortValue instanceof Date ? sortValue.toISOString() : String(sortValue),
    i: id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.s !== 'string' ||
      typeof parsed.i !== 'string' ||
      !uuidValidate(parsed.i)
    ) {
      throw new Error();
    }

    return parsed as CursorPayload;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
