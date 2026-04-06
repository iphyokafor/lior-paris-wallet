import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../shared/constants';

export class PasswordDto {
  @IsString()
  password: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
