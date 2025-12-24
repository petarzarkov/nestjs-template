import { IntersectionType } from '@nestjs/swagger';
import { DbVars } from './dto/db-vars.dto';
import { RedisVars } from './dto/redis-vars.dto';
import { ServiceVars } from './dto/service-vars.dto';

export class EnvVars extends IntersectionType(
  DbVars,
  IntersectionType(ServiceVars, RedisVars),
) {}
