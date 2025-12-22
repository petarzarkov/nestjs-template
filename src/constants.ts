import { PaginationOrder } from '@/core/pagination/enum/pagination-order.enum';

export const REQUEST_ID_HEADER_KEY = 'X-Request-Id';

export const BASE_USER_TEST_PASS = 'Test123$';

export const GLOBAL_PREFIX = 'api';

export const LOGGER = {
  defaultMaskFields: ['accessToken', 'jwt', 'password', 'secret', 'key', 'phone'],
  defaultFilterEvents: [
    `/${GLOBAL_PREFIX}/service/up`,
    `/${GLOBAL_PREFIX}/service/health`,
    '/favicon.ico',
  ],
} as const;

// Time constants (** in milliseconds **)
export const MILLISECOND = 1;
export const SECOND = 1000 * MILLISECOND;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const FILES = {
  MIN_SIZE: 1024, // 1KB
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_FILE_NAME_LENGTH: 6,
} as const;

export const PAGINATION = Object.freeze({
  ORDER_BY_PRECEDENCE: Object.freeze(['updatedAt', 'createdAt', 'id']),
  DEFAULT_ORDER: PaginationOrder.DESC,
  MIN_PAGE: 1,
  DEFAULT_PAGE: 1,
  MIN_TAKE: 1,
  DEFAULT_TAKE: 10,
  MAX_TAKE: 50,
  MAX_SEARCH: 256,
});
