/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResultDto } from '../dto/pagination.result.output';
import { PaginationQueryDto } from '../dto/paginationQuery.input';
import { Users } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  private async applyUpdatesAndSave(
    user: Users,
    updateData: Partial<Users>,
  ): Promise<Users> {
    Object.assign(user, updateData);
    return await this.usersRepository.save(user);
  }

  async createUser(data: Partial<Users>): Promise<Users> {
    const user = this.usersRepository.create(data);
    return await this.usersRepository.save(user);
  }

  async findUserByEmail(email: string): Promise<Users> {
    return await this.usersRepository.findOne({
      where: {
        email,
      },
    });
  }

  async findUserById(userId: string): Promise<Users> {
    return await this.usersRepository.findOne({
      where: {
        id: userId,
      },
    });
  }

  async findUserByIdWithWallets(userId: string): Promise<Users> {
    return await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['wallets'],
    });
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResultDto<Users>> {
    const { page, limit } = query;
    const [data, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
    });

    return new PaginatedResultDto<Users>(data, total);
  }

  async updateUserDetails(
    id: string,
    updateData: Partial<Users>,
  ): Promise<Users> {
    const user = await this.findUserById(id);

    return await this.applyUpdatesAndSave(user, updateData);
  }

  async deleteUser(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
