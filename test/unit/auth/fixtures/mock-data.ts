import { UserRole } from '../../../../src/shared/constants';

export const mockFindUserByEmail = jest.fn();
export const mockCreateUser = jest.fn();
export const mockSignToken = jest.fn();
export const mockFindUserById = jest.fn();
export const mockFindById = jest.fn();
export const mockUpdateUserPassword = jest.fn();

export const userData = {
  id: 'userId',
  name: 'test user',
  email: 'user@gmail.com',
  password: 'password',
  role: UserRole.User,
  created_at: new Date(),
  updated_at: new Date(),
};

const adminUserData = {
  id: 'adminUserId',
  name: 'test user',
  email: 'user@gmail.com',
  password: 'password',
  role: UserRole.Admin,
  created_at: new Date(),
  updated_at: new Date(),
};

export const registerUserInput = {
  name: userData.name,
  email: userData.email,
  password: userData.password,
};

export const registerAdminUserInput = {
  name: adminUserData.name,
  email: adminUserData.email,
  password: adminUserData.password,
  role: UserRole.Admin,
};

export const expectedUserResponse = {
  id: 'userId',
  name: 'test user',
  email: 'user@gmail.com',
  role: UserRole.User,
  created_at: new Date(),
  updated_at: new Date(),
  access_token: 'token',
};

export const loginInput = {
  email: 'test@gmail.com',
  password: 'password',
};

export const user = {
  id: 'userId',
  name: 'test user',
  email: 'test2@gmail.com',
  password: 'password2',
  role: UserRole.User,
  created_at: new Date(),
  updated_at: new Date(),
};

export const expectedResponse = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  access_token: 'token',
  created_at: user.created_at,
  updated_at: user.updated_at,
};

export const loginInput2 = {
  email: user.email,
  password: user.password,
};

export const userId = 'user-id';
export const oldPassword = 'oldPassword';
export const newPassword = 'newPassword';
export const incorrectOldPassword = 'wrongOldPassword';

export const adminUser = {
  id: 'userId-1',
  name: 'test user',
  email: 'test2@gmail.com',
  password: 'passwordAdmin',
  role: UserRole.Admin,
  created_at: new Date(),
  updated_at: new Date(),
};

export const expectedAdminResponse = {
  id: adminUser.id,
  name: adminUser.name,
  email: adminUser.email,
  role: adminUser.role,
  access_token: 'token',
  created_at: adminUser.created_at,
  updated_at: adminUser.updated_at,
};

export const loginInput3 = {
  email: adminUser.email,
  password: adminUser.password,
};
