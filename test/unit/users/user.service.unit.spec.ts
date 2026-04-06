import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { UsersPolicy } from '../../../src/features/users/policies/users.policy';
import { UsersService } from '../../../src/features/users/users.service';
import { UserRole } from '../../../src/shared/constants';
import { usersMockData } from '../../mocks/register-data';
import {
  mockUser,
  mockUsersList,
  mockUsersRepository,
} from './fixtures/mock-data';

describe('UsersService Unit Tests', () => {
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersPolicy,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: Logger,
          useValue: new Logger('UsersService'),
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user and return the result', async () => {
      const createdUser = { ...mockUser, ...usersMockData.registerDto };

      mockUsersRepository.createUser.mockResolvedValue(createdUser);

      const result = await usersService.createUser(usersMockData.registerDto);

      expect(result).toEqual(createdUser);
      expect(mockUsersRepository.createUser).toHaveBeenCalledWith(
        usersMockData.registerDto,
      );
    });

    it('should log an error and throw if repository throws', async () => {
      const error = new Error('Repository Error');

      mockUsersRepository.createUser.mockRejectedValue(error);

      await expect(
        usersService.createUser(usersMockData.registerDto),
      ).rejects.toThrow(error);

      expect(mockUsersRepository.createUser).toHaveBeenCalledWith(
        usersMockData.registerDto,
      );
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user if found', async () => {
      const email = 'test@example.com';
      mockUsersRepository.findUserByEmail.mockResolvedValue(mockUser);

      const result = await usersService.findUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockUsersRepository.findUserByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null if user is not found', async () => {
      const email = 'notfound@example.com';
      mockUsersRepository.findUserByEmail.mockResolvedValue(null);

      const result = await usersService.findUserByEmail(email);

      expect(result).toBeNull();
      expect(mockUsersRepository.findUserByEmail).toHaveBeenCalledWith(email);
    });

    it('should log an error and throw if repository throws', async () => {
      const email = 'test@example.com';
      const error = new Error('Repository Error');

      mockUsersRepository.findUserByEmail.mockRejectedValue(error);

      await expect(usersService.findUserByEmail(email)).rejects.toThrow(error);
      expect(mockUsersRepository.findUserByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe('userMe', () => {
    it('should return a user for a valid user ID', async () => {
      const userId = 'user-id';
      mockUsersRepository.findUserByIdWithWallets.mockResolvedValue(mockUser);

      const result = await usersService.userMe(userId);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        wallets: undefined,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(mockUsersRepository.findUserByIdWithWallets).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should log an error and throw if the repository throws', async () => {
      const userId = 'user-id';
      const error = new Error('Repository Error');
      mockUsersRepository.findUserByIdWithWallets.mockRejectedValue(error);

      await expect(usersService.userMe(userId)).rejects.toThrow(error);

      expect(mockUsersRepository.findUserByIdWithWallets).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('findAll', () => {
    it('should return a list of users and total count', async () => {
      mockUsersRepository.findAll.mockResolvedValue({
        data: mockUsersList,
        total: mockUsersList.length,
      });

      const result = await usersService.findAll(usersMockData.findAllQuery);

      expect(result).toEqual({
        data: mockUsersList,
        total: mockUsersList.length,
      });
      expect(mockUsersRepository.findAll).toHaveBeenCalledWith(
        usersMockData.findAllQuery,
      );
    });

    it('should log an error and throw if repository throws', async () => {
      const error = new Error('Repository Error');

      mockUsersRepository.findAll.mockRejectedValue(error);

      await expect(
        usersService.findAll(usersMockData.findAllQuery),
      ).rejects.toThrow(error);

      expect(mockUsersRepository.findAll).toHaveBeenCalledWith(
        usersMockData.findAllQuery,
      );
    });
  });

  describe('updateUserPassword', () => {
    it('should update the user password and return a SafeUserResultDto', async () => {
      const userId = 'user-id';
      const updateData = { password: 'newPassword123' };
      const updatedUser = { ...mockUser, updated_at: new Date() };

      mockUsersRepository.updateUserDetails.mockResolvedValue(updatedUser);

      const result = await usersService.updateUserPassword(userId, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUsersRepository.updateUserDetails).toHaveBeenCalledWith(
        userId,
        updateData,
      );
    });

    it('should log an error and throw if the repository throws', async () => {
      const userId = 'user-id';
      const updateData = { password: 'newPassword123' };
      const error = new Error('Repository Error');

      mockUsersRepository.updateUserDetails.mockRejectedValue(error);

      await expect(
        usersService.updateUserPassword(userId, updateData),
      ).rejects.toThrow(error);

      expect(mockUsersRepository.updateUserDetails).toHaveBeenCalledWith(
        userId,
        updateData,
      );
    });
  });

  describe('findUserById', () => {
    it('should return a user if the user exists', async () => {
      const userId = 'user-id';
      mockUsersRepository.findUserByIdWithWallets.mockResolvedValue(mockUser);

      const result = await usersService.findUserById(userId);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        wallets: undefined,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(mockUsersRepository.findUserByIdWithWallets).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should return null if the user does not exist', async () => {
      const userId = 'non-existent-id';
      mockUsersRepository.findUserByIdWithWallets.mockResolvedValue(null);

      await expect(usersService.findUserById(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log an error and throw if repository throws', async () => {
      const userId = 'user-id';
      const error = new Error('Repository Error');
      mockUsersRepository.findUserByIdWithWallets.mockRejectedValue(error);

      await expect(usersService.findUserById(userId)).rejects.toThrow(error);
      expect(mockUsersRepository.findUserByIdWithWallets).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('updateUserDetails', () => {
    it('should update user details and reflect the changes in the result', async () => {
      const requestingUserId = 'admin-id';
      const targetUserId = 'user-id';
      const updateData = { name: 'Updated User' };

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);
      mockUsersRepository.updateUserDetails.mockImplementation((id, data) => {
        return Promise.resolve({ ...mockUser, ...data });
      });

      const result = await usersService.updateUserDetails(
        requestingUserId,
        targetUserId,
        updateData,
        UserRole.Admin,
      );

      expect(result).toEqual({
        id: mockUser.id,
        name: 'Updated User',
        email: mockUser.email,
        role: mockUser.role,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });

    it('should throw ForbiddenException if unauthorized', async () => {
      const requestingUserId = 'user-id';
      const targetUserId = 'another-user-id';
      const updateData = { name: 'Test' };

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);

      await expect(
        usersService.updateUserDetails(
          requestingUserId,
          targetUserId,
          updateData,
          UserRole.User,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if a USER attempts to update role', async () => {
      const requestingUserId = 'user-id';
      const targetUserId = 'user-id';
      const updateData = { role: UserRole.Admin };

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);

      await expect(
        usersService.updateUserDetails(
          requestingUserId,
          targetUserId,
          updateData,
          UserRole.User,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if the user is not found', async () => {
      const requestingUserId = 'admin-id';
      const targetUserId = 'non-existent-id';
      const updateData = { name: 'Updated User' };

      mockUsersRepository.findUserById.mockResolvedValue(null);

      await expect(
        usersService.updateUserDetails(
          requestingUserId,
          targetUserId,
          updateData,
          UserRole.Admin,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete a user if the requester is an admin and the user exists', async () => {
      const requestingUserId = 'admin-id';
      const targetUserId = 'user-id';
      const role = UserRole.Admin;

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);

      await expect(
        usersService.deleteUser(requestingUserId, targetUserId, role),
      ).resolves.toBeUndefined();

      expect(mockUsersRepository.findUserById).toHaveBeenCalledWith(
        targetUserId,
      );
      expect(mockUsersRepository.deleteUser).toHaveBeenCalledWith(targetUserId);
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      const requestingUserId = 'admin-id';
      const targetUserId = 'non-existent-user-id';
      const role = UserRole.Admin;

      mockUsersRepository.findUserById.mockResolvedValue(null);

      await expect(
        usersService.deleteUser(requestingUserId, targetUserId, role),
      ).rejects.toThrow(NotFoundException);

      expect(mockUsersRepository.findUserById).toHaveBeenCalledWith(
        targetUserId,
      );
    });

    it('should throw ForbiddenException if trying to delete oneself', async () => {
      const requestingUserId = 'user-id';
      const targetUserId = 'user-id';
      const role = UserRole.Admin;

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);

      await expect(
        usersService.deleteUser(requestingUserId, targetUserId, role),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUsersRepository.findUserById).toHaveBeenCalledWith(
        targetUserId,
      );
    });

    it('should throw ForbiddenException if requester is not an admin', async () => {
      const requestingUserId = 'another-user-id';
      const targetUserId = 'user-id';
      const role = UserRole.User;

      mockUsersRepository.findUserById.mockResolvedValue(mockUser);

      await expect(
        usersService.deleteUser(requestingUserId, targetUserId, role),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUsersRepository.findUserById).toHaveBeenCalledWith(
        targetUserId,
      );
    });
  });
});
