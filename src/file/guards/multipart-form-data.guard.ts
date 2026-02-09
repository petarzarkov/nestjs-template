import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class MultipartFormDataGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const contentType = request.headers['content-type'];

    if (!contentType || !contentType.includes('multipart/form-data')) {
      throw new BadRequestException('Content type must be multipart/form-data');
    }

    return true;
  }
}
