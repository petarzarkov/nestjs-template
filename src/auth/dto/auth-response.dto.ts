import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuthResponseDto {
  @ApiProperty({
    description: 'jwt token',
  })
  @IsString()
  accessToken!: string;
}
