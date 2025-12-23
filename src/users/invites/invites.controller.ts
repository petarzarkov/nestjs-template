import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { ApiJwtAuth } from '@/core/decorators';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@/users/enum/user-role.enum';
import { CreateInviteDto } from '@/users/invites/dto/create-invite.dto';
import { ListInvitesQueryDto } from '@/users/invites/dto/list-invites.dto';
import { Invite } from '@/users/invites/entity/invite.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvitesService } from './services/invites.service';

@ApiTags('invites')
@ApiJwtAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  @ApiOperation({ summary: 'List user invitations and their statuses' })
  @ApiOkResponse({
    type: Invite,
    isArray: true,
  })
  list(@Query() query: ListInvitesQueryDto): Promise<Invite[]> {
    return this.invitesService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and send a new user invitation' })
  create(@Body() createInviteDto: CreateInviteDto): Promise<Invite> {
    return this.invitesService.create(createInviteDto);
  }
}
