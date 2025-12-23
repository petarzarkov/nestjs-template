import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'jwt token',
  })
  @IsString()
  accessToken!: string;
}
