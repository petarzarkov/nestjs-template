import { SanitizedUser } from '@/users/entity/user.entity';
import { E2E } from '../constants';

/** Better Auth sign-in / sign-up response body (bearer plugin returns `token`). */
export interface AuthResult {
  token: string;
  user: SanitizedUser;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
}

/**
 * HTTP client for E2E API testing
 */
export class ApiClient {
  private authToken: string | null = null;
  private readonly baseUrl: string;

  constructor(baseUrl = E2E.API_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = null;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as T;

    return {
      data,
      status: response.status,
      ok: response.ok,
    };
  }

  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  // Auth shortcuts (Better Auth native routes)
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await this.post<AuthResult>('/api/auth/sign-in/email', {
      email,
      password,
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
    }

    this.setAuthToken(response.data.token);
    return response.data;
  }

  async signUp(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<AuthResult> {
    const response = await this.post<AuthResult>('/api/auth/sign-up/email', {
      email: data.email,
      password: data.password,
      name: data.name ?? data.email.split('@')[0],
    });

    if (!response.ok) {
      throw new Error(`Register failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async getMe() {
    const response = await this.get<SanitizedUser>('/api/users/me');
    if (!response.ok) {
      throw new Error(`Get me failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  /**
   * Better Auth native sign-out — deletes the current session from Redis
   * (`secondaryStorage`) and expires the cookie. Uses the current bearer token
   * to identify the session, then clears it locally.
   */
  async logout(): Promise<{ success: boolean }> {
    const response = await this.post<{ success: boolean }>(
      '/api/auth/sign-out',
    );
    this.clearAuthToken();

    if (!response.ok) {
      throw new Error(`Logout failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }
}
