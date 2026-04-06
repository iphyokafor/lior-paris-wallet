import { IsAlphanumeric, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsAlphanumeric()
  @Length(5, 15, { message: 'Password must be between 5 and 15 characters!' })
  oldPassword: string;

  @IsAlphanumeric()
  @Length(5, 15, { message: 'Password must be between 5 and 15 characters!' })
  newPassword: string;
}
