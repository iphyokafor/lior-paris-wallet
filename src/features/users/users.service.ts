import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../shared/constants';
import { mapResult } from '../../shared/mapper';
import { RegisterDto } from '../auth/dto/register.input';
import { PaginationQueryDto } from './dto/paginationQuery.input';
import { PasswordDto } from './dto/update.input';
import { UserResultDto } from './dto/user.result.output';
import { Users } from './entities/user.entity';
import { UsersPolicy } from './policies/users.policy';
import { UsersRepository } from './repository/users.repository';
import { logIfUnexpectedOrServerError } from '../../shared/logging/log-if-unexpected-or-server-error';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(UsersPolicy) private readonly usersPolicy: UsersPolicy,
  ) {}

  async createUser(input: RegisterDto): Promise<UserResultDto> {
    try {
      return await this.usersRepository.createUser(input);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<Users> {
    try {
      return await this.usersRepository.findUserByEmail(email);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async userMe(userId: string): Promise<UserResultDto> {
    try {
      const user = await this.usersRepository.findUserByIdWithWallets(userId);

      return mapResult(user);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ data: Users[]; total: number }> {
    try {
      const users = await this.usersRepository.findAll(query);
      return users;
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async updateUserPassword(
    userId: string,
    updateData: PasswordDto,
  ): Promise<UserResultDto> {
    try {
      return await this.usersRepository.updateUserDetails(userId, updateData);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async findById(userId: string): Promise<Users> {
    try {
      const user = await this.usersRepository.findUserById(userId);

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return user;
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async findUserById(userId: string): Promise<UserResultDto> {
    try {
      const user = await this.usersRepository.findUserByIdWithWallets(userId);

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return mapResult(user);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }

  async updateUserDetails(
    requestingUserId: string,
    targetUserId: string,
    updateData: Partial<Users>,
    role: UserRole,
  ): Promise<UserResultDto> {
    const targetUser = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    this.usersPolicy.ensureCanUpdateUser(requestingUserId, targetUserId, role);
    if (updateData?.role) {
      this.usersPolicy.ensureCanUpdateRole(role);
    }

    const sanitizedUpdateData = this.usersPolicy.sanitizeUpdateData(
      updateData,
      role,
    );

    const updatedUser = await this.usersRepository.updateUserDetails(
      targetUserId,
      sanitizedUpdateData,
    );

    return mapResult(updatedUser);
  }

  async deleteUser(
    requestingUserId: string,
    targetUserId: string,
    role: UserRole,
  ): Promise<void> {
    try {
      const userToDelete =
        await this.usersRepository.findUserById(targetUserId);

      if (!userToDelete) {
        throw new NotFoundException(`User with ID ${targetUserId} not found`);
      }

      this.usersPolicy.ensureCanDeleteUser(
        requestingUserId,
        targetUserId,
        role,
      );

      await this.usersRepository.deleteUser(targetUserId);
    } catch (error) {
      logIfUnexpectedOrServerError(this.logger, error);
      throw error;
    }
  }
}
