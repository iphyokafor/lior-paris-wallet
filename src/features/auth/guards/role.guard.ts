import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../shared/constants';
import { ROLES_KEY } from '../../../shared/decorators/roles.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const rawRole = user?.role as unknown;
    const userRoles: string[] = this.normalizeUserRoles(rawRole);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }

  private normalizeUserRoles(rawRole: unknown): string[] {
    if (Array.isArray(rawRole)) {
      return rawRole;
    }
    if (typeof rawRole === 'string') {
      return [rawRole];
    }
    return [];
  }
}
