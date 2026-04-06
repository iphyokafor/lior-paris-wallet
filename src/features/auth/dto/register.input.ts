import { IsAlphanumeric, IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsAlphanumeric()
  @Length(5, 15, { message: 'Password must be between 5 and 15 characters!' })
  password: string;
}
