import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from '../../../src/features/auth/auth.service';
import { UsersService } from '../../../src/features/users/users.service';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { UsersPolicy } from '../../../src/features/users/policies/users.policy';
import { Users } from '../../../src/features/users/entities/user.entity';
import { UserRole } from '../../../src/shared/constants';
import { mockData } from '../../mocks/login-data';
import { usersMockData } from '../../mocks/register-data';
import { mysqlDataSource } from '../db/mysql/int-container';

describe('AuthService Integration Tests', () => {
  let authService: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
        }),
      ],
      providers: [
        AuthService,
        UsersService,
        UsersRepository,
        UsersPolicy,
        {
          provide: getRepositoryToken(Users),
          useValue: mysqlDataSource.getRepository(Users),
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should register a new user', async () => {
    const result = await authService.register(usersMockData.registerDto);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('access_token');
    expect(result.email).toBe(usersMockData.registerDto.email);
  });

  it('should ignore any supplied role during registration', async () => {
    const result = await authService.register(
      usersMockData.adminRegisterDto as any,
    );

    expect(result.role).toBe(UserRole.User);
  });

  it('should sign in an existing user', async () => {
    const registerResult = await authService.register(
      usersMockData.existingRegisterDto,
    );
    const loginResult = await authService.login(mockData.loginDto);

    expect(loginResult).toHaveProperty('access_token');
    expect(loginResult.email).toBe(registerResult.email);
  });

  it('should fail to sign in with incorrect credentials', async () => {
    await expect(
      authService.login(mockData.nonExistentLoginDto),
    ).rejects.toThrow();
  });

  it('should check for duplicate email during registration', async () => {
    await authService.register(usersMockData.userRegisterDto);

    await expect(
      authService.register(usersMockData.duplicateRegisterDto),
    ).rejects.toThrow();
  });
});
