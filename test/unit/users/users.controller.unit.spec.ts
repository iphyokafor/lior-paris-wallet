import { UsersController } from '../../../src/features/users/users.controller';
import { PaginationQueryDto } from '../../../src/features/users/dto/paginationQuery.input';
import { UserRole } from '../../../src/shared/constants';

describe('UsersController Unit Tests', () => {
  const now = new Date('2020-01-01T00:00:00.000Z');

  const makeUser = (overrides: Partial<any> = {}) => ({
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    role: UserRole.User,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  const usersService = {
    userMe: jest.fn(),
    findAll: jest.fn(),
    findUserById: jest.fn(),
    updateUserDetails: jest.fn(),
    deleteUser: jest.fn(),
  };

  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(usersService as any);
  });

  it('userMe returns JSON:API document', async () => {
    const user = makeUser();
    usersService.userMe.mockResolvedValueOnce(user);

    const result = await controller.userMe({ user: { id: user.id } } as any);

    expect(usersService.userMe).toHaveBeenCalledWith(user.id);
    expect(result).toEqual({
      data: {
        type: 'users',
        id: user.id,
        attributes: {
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
      meta: undefined,
      links: undefined,
    });
  });

  it('findAll defaults page/limit when non-numeric', async () => {
    const users = [makeUser({ id: 'u1' }), makeUser({ id: 'u2' })];
    usersService.findAll.mockResolvedValueOnce({ data: users, total: 2 });

    const result = await controller.findAll('nope' as any, 'nah' as any);

    expect(usersService.findAll).toHaveBeenCalledWith(
      expect.any(PaginationQueryDto),
    );

    const calledQuery: PaginationQueryDto =
      usersService.findAll.mock.calls[0][0];
    expect(calledQuery.page).toBe(1);
    expect(calledQuery.limit).toBe(10);

    expect(result.meta).toEqual({ total: 2, total_pages: 1 });
    expect(result.links).toEqual({ prev: null, next: null });
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as any[])[0]).toHaveProperty('type', 'users');
  });

  it('findAll builds pagination links', async () => {
    const users = [makeUser({ id: 'u1' }), makeUser({ id: 'u2' })];
    usersService.findAll.mockResolvedValueOnce({ data: users, total: 10 });

    const result = await controller.findAll(2 as any, 2 as any);

    expect(result.meta).toEqual({ total: 10, total_pages: 5 });
    expect(result.links).toEqual({
      prev: '/users?page=1&limit=2',
      next: '/users?page=3&limit=2',
    });
  });

  it('findUserById returns JSON:API document', async () => {
    const user = makeUser({ id: 'target' });
    usersService.findUserById.mockResolvedValueOnce(user);

    const result = await controller.findUserById(user.id);

    expect(usersService.findUserById).toHaveBeenCalledWith(user.id);
    expect(result.data).toHaveProperty('id', user.id);
  });

  it('updateUserDetails calls service with requester context', async () => {
    const updated = makeUser({ id: 'target', name: 'Updated' });
    usersService.updateUserDetails.mockResolvedValueOnce(updated);

    const req = { user: { id: 'requester', role: UserRole.Admin } };
    const body = { name: 'Updated' };

    const result = await controller.updateUserDetails(
      req as any,
      body as any,
      'target',
    );

    expect(usersService.updateUserDetails).toHaveBeenCalledWith(
      'requester',
      'target',
      body,
      UserRole.Admin,
    );
    expect(result.data.attributes.name).toBe('Updated');
  });

  it('deleteUser calls service and returns void', async () => {
    usersService.deleteUser.mockResolvedValueOnce(undefined);

    const req = { user: { id: 'requester', role: UserRole.Admin } };

    const result = await controller.deleteUser(req as any, 'target');

    expect(usersService.deleteUser).toHaveBeenCalledWith(
      'requester',
      'target',
      UserRole.Admin,
    );
    expect(result).toBeUndefined();
  });
});
