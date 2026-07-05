import { ApiProperty } from '@nestjs/swagger';
import { OAuthProvider } from '../enum/oauth-provider.enum';

export class AuthProvider {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: Object.values(OAuthProvider) })
  provider!: OAuthProvider;

  @ApiProperty({ nullable: true })
  authProviderId!: string | null;

  passwordHash!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
