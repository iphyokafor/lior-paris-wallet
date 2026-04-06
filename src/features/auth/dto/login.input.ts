import { IsAlphanumeric, IsEmail, Length } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsAlphanumeric()
  @Length(5, 15, { message: 'Password must be between 5 and 15 characters!' })
  password: string;
}
