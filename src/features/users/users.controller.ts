import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Request,
  UsePipes,
} from '@nestjs/common';
import { UserRole } from '../../shared/constants';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JsonApiResource, jsonApiData } from '../../shared/jsonapi/jsonapi';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { updateUserSchema, userIdSchema } from '../../shared/schemas';
import { PaginationQueryDto } from './dto/paginationQuery.input';
import { UpdateUserDto } from './dto/update.input';
import { Users } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('/me')
  async userMe(@Request() req) {
    const user = await this.usersService.userMe(req.user.id);
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        wallets: user.wallets,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
    return jsonApiData(resource);
  }

  @Roles(UserRole.Admin)
  @Get('/')
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const pageNumber = Number.isNaN(Number(page)) ? 1 : Number(page);
    const limitNumber = Number.isNaN(Number(limit)) ? 10 : Number(limit);

    const query = new PaginationQueryDto(pageNumber, limitNumber);

    const { data, total } = await this.usersService.findAll(query);

    const totalPages = Math.ceil(total / limitNumber);

    const resources: Array<JsonApiResource<Record<string, unknown>>> = data.map(
      (user: Users) => ({
        type: 'users',
        id: user.id,
        attributes: {
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      }),
    );

    return jsonApiData(resources, {
      meta: {
        total,
        total_pages: totalPages,
      },
      links: {
        prev:
          pageNumber > 1
            ? `/users?page=${pageNumber - 1}&limit=${limitNumber}`
            : null,
        next:
          pageNumber < totalPages
            ? `/users?page=${pageNumber + 1}&limit=${limitNumber}`
            : null,
      },
    });
  }

  @Roles(UserRole.Admin)
  @Get('/:id')
  @UsePipes(
    new ZodValidationPipe({
      param: userIdSchema,
    }),
  )
  async findUserById(@Param('id') id: string) {
    const user = await this.usersService.findUserById(id);
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        wallets: user.wallets,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
    return jsonApiData(resource);
  }

  @Patch('/:id')
  @UsePipes(
    new ZodValidationPipe({
      body: updateUserSchema,
      param: userIdSchema,
    }),
  )
  async updateUserDetails(
    @Request() req,
    @Body() data: UpdateUserDto,
    @Param('id') id: string,
  ) {
    const user = await this.usersService.updateUserDetails(
      req.user.id,
      id,
      data,
      req.user.role,
    );
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
    return jsonApiData(resource);
  }

  @Delete('/:id')
  @HttpCode(204)
  @UsePipes(
    new ZodValidationPipe({
      param: userIdSchema,
    }),
  )
  async deleteUser(@Request() req, @Param('id') id: string): Promise<void> {
    await this.usersService.deleteUser(req.user.id, id, req.user.role);
  }
}
