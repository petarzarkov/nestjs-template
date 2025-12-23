import { IsEmailDecorator } from '@/core/decorators/email.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';

export class RegisterWithEmailDto {
  @PasswordDecorator()
  password!: string;

  @IsEmailDecorator()
  email!: string;
}
