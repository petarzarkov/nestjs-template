import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { Public } from '@/core/decorators/public.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { AcceptInviteDto } from '@/users/invites/dto/accept-invite.dto';
import { CreateInviteDto } from '@/users/invites/dto/create-invite.dto';
import { ListInvitesQueryDto } from '@/users/invites/dto/list-invites.dto';
import { Invite } from '@/users/invites/entity/invite.entity';
import { InvitesService } from './services/invites.service';

@ApiTags('invites')
@ApiJwtAuth()
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
  list(@Query() query: ListInvitesQueryDto): Invite[] {
    return this.invitesService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and send a new user invitation' })
  create(@Body() createInviteDto: CreateInviteDto): Promise<Invite> {
    return this.invitesService.create(createInviteDto);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept an invitation and register the account (public)',
  })
  @ApiOkResponse({ type: SanitizedUser })
  acceptInvite(@Body() dto: AcceptInviteDto): Promise<SanitizedUser> {
    return this.invitesService.acceptInvite(dto);
  }
}
