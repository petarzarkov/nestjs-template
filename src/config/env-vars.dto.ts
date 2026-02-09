import { IntersectionType } from '@nestjs/swagger';
import { AIVars } from './dto/ai-vars.dto';
import { AWSConfigVars } from './dto/aws-vars.dto';
import { DbVars } from './dto/db-vars.dto';
import { OAuthVars } from './dto/oauth-vars.dto';
import { RedisVars } from './dto/redis-vars.dto';
import { ServiceVars } from './dto/service-vars.dto';

export class EnvVars extends IntersectionType(
  DbVars,
  ServiceVars,
  RedisVars,
  OAuthVars,
  AIVars,
  AWSConfigVars,
) {}
