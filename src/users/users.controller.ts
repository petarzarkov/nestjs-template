import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import {
  ApiJwtAuth,
  ApiUuidParam,
  CurrentUser,
  UuidParam,
} from '@/core/decorators';
import { Roles } from '@/core/decorators/roles.decorator';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginatedDto } from '@/core/pagination/dto/paginated.dto';
import { GetUsersQueryDto, UpdateUserDto } from '@/users/dto/user.dto';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { UsersService } from './services/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiJwtAuth()
  @ApiOperation({ summary: 'Get users list' })
  @ApiOkResponse({
    description: 'A paginated list of users.',
    type: PaginatedDto(SanitizedUser),
  })
  async getUsers(
    @CurrentUser() _currentUser: SanitizedUser,
    @Query() queryDto: GetUsersQueryDto,
  ): Promise<PageDto<SanitizedUser>> {
    return this.usersService.getUsersPaginated(queryDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiJwtAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: SanitizedUser })
  async getMe(
    @CurrentUser() user: SanitizedUser,
  ): Promise<SanitizedUser | null> {
    return this.usersService.findById(user.id);
  }

  @Post(':userId/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiJwtAuth()
  @ApiOperation({
    summary:
      'Suspend a given user so it no longer can use the platform until explicitly activated again',
  })
  @ApiUuidParam({ name: 'userId', description: 'User identifier' })
  @ApiOkResponse({ type: SanitizedUser })
  async suspendUser(
    @CurrentUser() user: SanitizedUser,
    @UuidParam({ name: 'userId' }) userId: string,
  ): Promise<SanitizedUser> {
    if (user.id === userId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    return this.usersService.updateUser(userId, { suspended: true });
  }

  @Post(':userId/reinstate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Remove user suspension so it is able to use the platform again',
  })
  @ApiUuidParam({ name: 'userId', description: 'User identifier' })
  @ApiOkResponse({ type: SanitizedUser })
  async reinstateUser(
    @UuidParam({ name: 'userId' }) userId: string,
  ): Promise<SanitizedUser> {
    return this.usersService.updateUser(userId, { suspended: false });
  }

  @Patch(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Update user properties',
  })
  @ApiUuidParam({ name: 'userId', description: 'User identifier' })
  @ApiOkResponse({ type: SanitizedUser })
  async updateUser(
    @UuidParam({ name: 'userId' }) userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<SanitizedUser> {
    return this.usersService.updateUser(userId, updateUserDto);
  }
}
