import { timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppEnv } from '@/config/enum/app-env.enum';
import { AppConfigService } from '@/config/services/app.config.service';

@Injectable()
export class HtmlBasicAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: AppConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const env = this.configService.get('app.env');
    const token = this.configService.getOrThrow('app.basicAuthToken');

    if (env === AppEnv.LOCAL || !token) {
      return next();
    }

    const username = 'admin';
    const cookieName = 'x-auth-token';

    const authCookie = this.getCookie(req, cookieName);
    if (authCookie) {
      if (this.validateToken(authCookie, username, token)) {
        return next();
      }
    }

    if (req.method === 'POST') {
      const body = await this.parseBody(req);
      const { username: inputUser, password: inputPassword } = body;

      if (this.validateCredentials(inputUser, inputPassword, username, token)) {
        const sessionToken = Buffer.from(`${username}:${token}`).toString(
          'base64',
        );

        res.setHeader(
          'Set-Cookie',
          `${cookieName}=${sessionToken}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
        );

        const redirectUrl = req.baseUrl || req.originalUrl.split('?')[0];
        return res.redirect(redirectUrl);
      }

      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send(
          this.renderHtml(
            'Restricted Area',
            HttpStatus[HttpStatus.UNAUTHORIZED],
          ),
        );
    }

    return res
      .status(HttpStatus.UNAUTHORIZED)
      .send(this.renderHtml('Restricted Area'));
  }

  private validateCredentials(
    inputUser: string,
    inputPass: string,
    validUser: string,
    validPass: string,
  ): boolean {
    if (!inputUser || !inputPass) return false;
    return (
      this.safeCompare(inputUser, validUser) &&
      this.safeCompare(inputPass, validPass)
    );
  }

  private validateToken(
    cookieVal: string,
    validUser: string,
    validPass: string,
  ): boolean {
    try {
      const decoded = Buffer.from(cookieVal, 'base64').toString('utf-8');
      const [user, pass] = decoded.split(':');
      return this.validateCredentials(user, pass, validUser, validPass);
    } catch {
      return false;
    }
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private getCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    const match = header.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : undefined;
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
            <input type="text" name="username" placeholder="Username" required autofocus>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Sign In</button>
          </form>
        </div>
      </body>
      </html>
    `;
  }
}
