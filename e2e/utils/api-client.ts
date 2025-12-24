import { E2E } from '../constants';

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

  // Auth shortcuts
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const response = await this.post<{ accessToken: string }>(
      '/api/auth/login',
      {
        email,
        password,
      },
    );

    if (!response.ok) {
      throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
    }

    this.setAuthToken(response.data.accessToken);
    return response.data;
  }

  async register(data: {
    email: string;
    password: string;
    inviteCode: string;
  }): Promise<{ id: string; email: string }> {
    const response = await this.post<{ id: string; email: string }>(
      '/api/auth/register',
      data,
    );

    if (!response.ok) {
      throw new Error(`Register failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async getMe(): Promise<{ id: string; email: string; roles: string[] }> {
    const response = await this.get<{
      id: string;
      email: string;
      roles: string[];
    }>('/api/users/me');

    if (!response.ok) {
      throw new Error(`Get me failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }
}
