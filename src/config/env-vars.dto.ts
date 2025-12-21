import { IntersectionType } from '@nestjs/swagger';
import { DbVars } from './dto/db-vars.dto';
import { ServiceVars } from './dto/service-vars.dto';

export class EnvVars extends IntersectionType(DbVars, ServiceVars) {}
