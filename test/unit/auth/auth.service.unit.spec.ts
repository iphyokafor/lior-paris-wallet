import {
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon from 'argon2';
import { UsersService } from '../../../src/features/users/users.service';
import { UserRole } from '../../../src/shared/constants';

import { AuthService } from '../../../src/features/auth/auth.service';
import {
  adminUser,
  expectedAdminResponse,
  expectedResponse,
  expectedUserResponse,
  incorrectOldPassword,
  loginInput,
  loginInput2,
  loginInput3,
  mockCreateUser,
  mockFindById,
  mockFindUserByEmail,
  mockFindUserById,
  mockSignToken,
  mockUpdateUserPassword,
  newPassword,
  oldPassword,
  registerUserInput,
  registerAdminUserInput,
  user,
  userData,
  userId,
} from './fixtures/mock-data';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findUserByEmail: mockFindUserByEmail,
            createUser: mockCreateUser,
            findUserById: mockFindUserById,
            updateUserPassword: mockUpdateUserPassword,
            findById: mockFindById,
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: mockSignToken,
          },
        },
        {
          provide: Logger,
          useValue: new Logger('AuthService'),
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('Register flow', () => {
    it('should register a user and return the user', async () => {
      mockCreateUser.mockResolvedValueOnce(userData);
      mockSignToken.mockReturnValueOnce('token');

      const response = await authService.register(registerUserInput);

      expect(response).toEqual(expectedUserResponse);
    });

    it('should ignore any supplied role during registration', async () => {
      mockCreateUser.mockResolvedValueOnce(userData);
      mockSignToken.mockReturnValueOnce('token');

      const response = await authService.register(
        registerAdminUserInput as any,
      );

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.User }),
      );
      expect(response).toEqual(expectedUserResponse);
      expect(response.role).toBe(UserRole.User);
    });

    it('should throw ConflictException if the email is already in use', async () => {
      const email = 'existing@example.com';

      mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-id', email });

      await expect(authService.checkDuplicateEmail(email)).rejects.toThrow(
        ConflictException,
      );

      expect(mockFindUserByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe('Login flow', () => {
    it('should throw an UnauthorizedException if the user cannot be logged in', async () => {
      mockFindUserByEmail.mockResolvedValueOnce(null);
      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should log in a user and return user details along with an access token', async () => {
      const payload = {
        ...user,
        password: await argon.hash(user.password),
      };

      mockFindUserByEmail.mockResolvedValueOnce(payload);
      mockSignToken.mockReturnValueOnce('token');

      const response = await authService.login(loginInput2);

      expect(response).toEqual(expectedResponse);
    });

    it('should log in an admin user and return admin user details along with an access token', async () => {
      const payload = {
        ...adminUser,
        password: await argon.hash(adminUser.password),
      };

      mockFindUserByEmail.mockResolvedValueOnce(payload);
      mockSignToken.mockReturnValueOnce('token');

      const response = await authService.login(loginInput3);

      expect(response).toEqual(expectedAdminResponse);
    });
  });

  describe('ChangePassword flow', () => {
    it('should change the password if the old password matches', async () => {
      const hashedOldPassword = await argon.hash(oldPassword);
      const hashedNewPassword = await argon.hash(newPassword);

      const user = {
        id: userId,
        password: hashedOldPassword,
      };

      mockFindById.mockResolvedValueOnce(user);
      mockUpdateUserPassword.mockResolvedValueOnce({
        id: userId,
        password: hashedNewPassword,
      });

      const result = await authService.changePassword(userId, {
        oldPassword,
        newPassword,
      });

      expect(mockFindById).toHaveBeenCalledWith(userId);
      expect(argon.verify(user.password, oldPassword)).resolves.toBeTruthy();
      expect(mockUpdateUserPassword).toHaveBeenCalledWith(userId, {
        password: expect.any(String),
      });
      expect(result).toEqual('Password updated successfully');
    });

    it('should throw UnauthorizedException if the old password does not match', async () => {
      const user = {
        id: userId,
        password: await argon.hash(oldPassword),
      };

      mockFindById.mockResolvedValueOnce(user);

      await expect(
        authService.changePassword(userId, {
          oldPassword: incorrectOldPassword,
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockFindById).toHaveBeenCalledWith(userId);
    });

    it('should log an error and throw if an error occurs', async () => {
      const error = new Error('Database error');

      mockFindById.mockRejectedValueOnce(error);

      await expect(
        authService.changePassword(userId, {
          oldPassword,
          newPassword,
        }),
      ).rejects.toThrow(error);

      expect(mockFindById).toHaveBeenCalledWith(userId);
    });
  });
});
