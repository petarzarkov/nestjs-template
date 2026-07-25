import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import type { Auth } from '@/auth/auth.config';
import { AppEnv } from '@/config/enum/app-env.enum';
import { AppConfigService } from '@/config/services/app.config.service';

/**
 * Gates the browser-facing ops pages that live OUTSIDE Nest's routing — the
 * Swagger/Scalar docs and the Bull Board queue dashboard (raw Express mounts the
 * global Better Auth `AuthGuard` never sees). Access requires any valid Better
 * Auth session (any authenticated user, no specific role):
 *   - a valid session cookie → pass straight through
 *   - otherwise a self-contained login form is rendered; submitting it signs in
 *     through Better Auth (`signInEmail`), forwards the resulting session cookie
 *     to the browser, and reloads the page
 *
 * There is no shared secret — access is tied to real user accounts (revocable,
 * auditable). Bypassed entirely in local for developer convenience.
 */
@Injectable()
export class HtmlSessionAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: AppConfigService,
    private readonly authService: AuthService<Auth>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (this.configService.get('app.env') === AppEnv.LOCAL) {
      return next();
    }

    // Already signed in (session cookie present + valid)?
    const session = await this.authService.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session?.user) {
      return next();
    }

    if (req.method === 'POST') {
      return this.handleLogin(req, res);
    }

    return res
      .status(HttpStatus.UNAUTHORIZED)
      .send(this.renderHtml('Restricted Area'));
  }

  /** Handle the login-form submission: sign in via Better Auth, gate on role. */
  private async handleLogin(req: Request, res: Response) {
    const { email, password } = await this.parseBody(req);

    if (!email || !password) {
      return this.deny(
        res,
        HttpStatus.UNAUTHORIZED,
        'Email and password required',
      );
    }

    const authRes = await this.authService.api.signInEmail({
      body: { email, password },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    if (!authRes.ok) {
      return this.deny(res, HttpStatus.UNAUTHORIZED, 'Invalid credentials');
    }

    // Forward Better Auth's session cookie(s) to the browser, then reload so the
    // now-authenticated request passes the check above.
    const cookies = authRes.headers.getSetCookie();
    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }
    return res.redirect(req.baseUrl || req.originalUrl.split('?')[0]);
  }

  private deny(res: Response, status: HttpStatus, error: string) {
    return res.status(status).send(this.renderHtml('Restricted Area', error));
  }

  private parseBody(req: Request): Promise<Record<string, string>> {
    return new Promise(resolve => {
      if (
        req.body &&
        typeof req.body === 'object' &&
        Object.keys(req.body).length > 0
      ) {
        return resolve(req.body);
      }

      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const bodyStr = Buffer.concat(chunks).toString();
        const params = new URLSearchParams(bodyStr);
        const result: Record<string, string> = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        resolve(result);
      });
    });
  }

  private renderHtml(realm: string, error?: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${realm} - Login</title>
        <style>
          body { font-family: sans-serif; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 320px; text-align: center; }
          h2 { margin-top: 0; color: #333; }
          input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #0056b3; }
          .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; margin-bottom: 1rem; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Login</h2>
          ${error ? `<div class="error">${error}</div>` : ''}
          <form method="POST">
            <input type="email" name="email" placeholder="Email" required autofocus>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Sign In</button>
          </form>
        </div>
      </body>
      </html>
    `;
  }
}
