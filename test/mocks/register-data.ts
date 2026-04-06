import { UserRole } from '../../src/shared/constants';

export const usersMockData = {
  registerDto: {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'testPassword123',
  },

  adminRegisterDto: {
    name: 'Admin User',
    email: 'testadminuser@example.com',
    password: 'testPassword123',
    role: UserRole.Admin,
  },

  existingRegisterDto: {
    name: 'Existing User',
    email: 'cassie@gmail.com',
    password: 'testPassword123',
  },

  userRegisterDto: {
    name: 'Test User',
    email: 'duplicate@example.com',
    password: 'testPassword123',
  },

  duplicateRegisterDto: {
    name: 'Duplicate User',
    email: 'duplicate@example.com',
    password: 'testPassword123',
  },

  createUserInput: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password456',
    role: UserRole.User,
  },

  userUpdateData: {
    name: 'Johnathan Doe',
  },

  findAllQuery: { page: 1, limit: 10 },

  userData: {
    id: 'userId',
    name: 'test user',
    email: 'user@gmail.com',
    password: 'password',
    role: UserRole.User,
    created_at: new Date(),
    updated_at: new Date(),
  },

  adminUserData: {
    id: 'adminUserId',
    name: 'test user',
    email: 'user@gmail.com',
    password: 'password',
    role: UserRole.Admin,
    created_at: new Date(),
    updated_at: new Date(),
  },
};
