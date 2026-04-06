import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../shared/constants';
import { Users } from '../entities/user.entity';

@Injectable()
export class UsersPolicy {
  ensureCanUpdateUser(
    requestingUserId: string,
    targetUserId: string,
    role: UserRole,
  ): void {
    const isSelf = requestingUserId === targetUserId;
    const isAdmin = role === UserRole.Admin;

    if (isSelf || isAdmin) return;

    throw new ForbiddenException('You do not have permission to update user');
  }

  ensureCanUpdateRole(role: UserRole): void {
    if (role === UserRole.Admin) return;
    throw new ForbiddenException('You do not have permission to update role');
  }

  ensureCanDeleteUser(
    requestingUserId: string,
    targetUserId: string,
    role: UserRole,
  ): void {
    if (requestingUserId === targetUserId) {
      throw new ForbiddenException('You cannot delete yourself');
    }

    if (role !== UserRole.Admin) {
      throw new ForbiddenException(
        'You do not have permission to delete users',
      );
    }
  }

  sanitizeUpdateData(
    updateData: Partial<Users>,
    role: UserRole,
  ): Partial<Users> {
    const sanitized: Partial<Users> = { ...updateData };

    delete (sanitized as Partial<Users> & { password?: unknown }).password;
    delete (sanitized as Partial<Users> & { email?: unknown }).email;

    if (role !== UserRole.Admin) {
      delete (sanitized as Partial<Users> & { role?: unknown }).role;
    }

    return sanitized;
  }
}
