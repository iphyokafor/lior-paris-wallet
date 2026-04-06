import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../../src/features/users/users.service';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { UsersPolicy } from '../../../src/features/users/policies/users.policy';
import { Users } from '../../../src/features/users/entities/user.entity';
import { UserRole } from '../../../src/shared/constants';
import { usersMockData } from '../../mocks/register-data';
import { mysqlDataSource } from '../db/mysql/int-container';

describe('UserService Integration Tests', () => {
  let usersService: UsersService;

  const uniqueEmail = (prefix: string) =>
    `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersRepository,
        UsersPolicy,
        {
          provide: getRepositoryToken(Users),
          useValue: mysqlDataSource.getRepository(Users),
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userInput = {
        ...usersMockData.registerDto,
        email: uniqueEmail('create'),
      };

      const result = await usersService.createUser(userInput);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', userInput.email);
      expect(result).toHaveProperty('name', userInput.name);
    });
  });

  describe('updateUserDetails', () => {
    it('should update user details successfully', async () => {
      const userInput = {
        ...usersMockData.createUserInput,
        email: uniqueEmail('update'),
      };
      const createdUser = await usersService.createUser(userInput);

      const updateData = usersMockData.userUpdateData;
      const updatedUser = await usersService.updateUserDetails(
        createdUser.id,
        createdUser.id,
        updateData,
        UserRole.User,
      );

      expect(updatedUser).toHaveProperty('id', createdUser.id);
      expect(updatedUser).toHaveProperty('name', updateData.name);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      await expect(
        usersService.updateUserDetails(
          'invalid-id',
          'invalid-id',
          usersMockData.userUpdateData,
          UserRole.User,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should throw ForbiddenException if user tries to delete themselves', async () => {
      const userInput = {
        ...usersMockData.registerDto,
        email: uniqueEmail('selfdelete'),
      };
      const createdUser = await usersService.createUser(userInput);

      await expect(
        usersService.deleteUser(createdUser.id, createdUser.id, UserRole.User),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return a list of users', async () => {
      const user = {
        ...usersMockData.createUserInput,
        email: uniqueEmail('list'),
      };

      await usersService.createUser(user);

      const result = await usersService.findAll(usersMockData.findAllQuery);

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.some((u) => u.email === user.email)).toBe(true);
    });
  });
});
