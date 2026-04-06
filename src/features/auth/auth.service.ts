import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';
import { mapResult } from '../../shared/mapper';
import { UserRole } from '../../shared/constants';
import { DomainEventName } from '../../shared/events';
import { UserResultDto } from '../users/dto/user.result.output';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.input';
import { LoginDto } from './dto/login.input';
import { RegisterDto } from './dto/register.input';
import { CreateTokenResponse } from './types/auth.type';
import { logIfUnexpectedOrServerError } from '../../shared/logging/log-if-unexpected-or-server-error';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(input: RegisterDto): Promise<UserResultDto> {
    try {
      const { name, email, password } = input;

      await this.checkDuplicateEmail(email);

      const hashedPassword = await argon.hash(password);
      const payload = {
        name,
        email,
        password: hashedPassword,
        role: UserRole.User,
      };

      const savedUser = await this.usersService.createUser(payload);

      this.eventEmitter.emit(DomainEventName.UserRegistered, {
        userId: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
      });

      const { access_token } = await this.createLoginToken(
        savedUser.id,
        savedUser.email,
      );

      return mapResult(savedUser, access_token);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async login(input: LoginDto): Promise<UserResultDto> {
    const { email, password } = input;

    try {
      const user = await this.usersService.findUserByEmail(email);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials provided');
      }

      const isPasswordMatch = await argon.verify(user?.password, password);

      if (!isPasswordMatch) {
        throw new UnauthorizedException('Invalid credentials provided');
      }

      const { access_token } = await this.createLoginToken(user.id, user.email);

      return mapResult(user, access_token);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async createLoginToken(
    userId: string,
    email: string,
  ): Promise<CreateTokenResponse> {
    const token = this.jwtService.sign({
      userId,
      email,
    });

    return { access_token: token };
  }

  async checkDuplicateEmail(email: string): Promise<void> {
    const existingUser = await this.usersService.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }
  }

  async changePassword(
    userId: string,
    input: ChangePasswordDto,
  ): Promise<string> {
    try {
      const { oldPassword, newPassword } = input;

      const user = await this.usersService.findById(userId);

      const isPasswordMatch = await argon.verify(user.password, oldPassword);

      if (!isPasswordMatch) {
        throw new UnauthorizedException('Invalid credentials provided');
      }

      const hashedPassword = await argon.hash(newPassword);

      const result = await this.usersService.updateUserPassword(userId, {
        password: hashedPassword,
      });

      if (result) {
        return 'Password updated successfully';
      }
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }
}
