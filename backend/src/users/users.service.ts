import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
    }));
  }

  async update(id: string, dto: { role?: string; active?: boolean }, actingUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Guard: don't let an admin lock themselves out or demote the last admin.
    if (id === actingUserId && (dto.role === 'member' || dto.active === false)) {
      throw new BadRequestException('You cannot demote or deactivate your own admin account');
    }
    if (user.role === 'admin' && dto.role === 'member') {
      const adminCount = await this.prisma.user.count({ where: { role: 'admin', active: true } });
      if (adminCount <= 1) throw new BadRequestException('At least one active admin is required');
    }

    const data: Record<string, unknown> = {};
    if (dto.role === 'admin' || dto.role === 'member') data.role = dto.role;
    if (typeof dto.active === 'boolean') data.active = dto.active;
    const updated = await this.prisma.user.update({ where: { id }, data });
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, active: updated.active };
  }
}
