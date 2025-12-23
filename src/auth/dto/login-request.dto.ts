import { IsEmailDecorator } from '@/core/decorators/email.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';

export class LoginRequestDto {
  @IsEmailDecorator()
  email!: string;

  @PasswordDecorator()
  password!: string;
}
