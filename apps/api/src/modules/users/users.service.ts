import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import * as argon2 from "argon2";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId?: string) {
    if (!userId) {
      return {
        id: "usr_998124aether",
        email: "growth.lead@nexusmedia.io",
        name: "Alex Vance",
        balance: 2450.0,
        currency: "INR",
        tier: "PRO_SCALE",
        apiKey: "aeth_live_9f81a7b3c4d5e6f7a8b9c0d1e2f3a4b5",
        twoFactorEnabled: true,
        totalSpent: 48920.0,
        totalOrders: 125,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) throw new NotFoundException(`User #${userId} not found.`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tier: user.tier,
      balance: user.wallet?.balance ? Number(user.wallet.balance) : 0,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  async updateProfile(userId: string, body: { name?: string; tier?: string }) {
    if (userId) {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: body.name ? body.name.trim() : undefined,
          tier: body.tier || undefined,
        },
      });
      return { success: true, user };
    }
    return { success: true, updated: body };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false },
      include: { wallet: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      tier: u.tier,
      balance: u.wallet?.balance ? Number(u.wallet.balance) : 0,
      createdAt: u.createdAt,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException(`User #${id} not found.`);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tier: user.tier,
      balance: user.wallet?.balance ? Number(user.wallet.balance) : 0,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    };
  }

  async update(id: string, body: any) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name || undefined,
        role: body.role || undefined,
        tier: body.tier || undefined,
      },
    });
    return { success: true, user };
  }

  async remove(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return { success: true, message: `User #${id} soft-deleted.` };
  }

  async updateStatus(id: string, body: { role?: any; tier?: string }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role: body.role || undefined,
        tier: body.tier || undefined,
      },
    });
    return { success: true, user };
  }

  async adminResetPassword(id: string, body: { newPassword?: string }) {
    const newPassword = body.newPassword || "TemporaryP@ss123!";
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { success: true, message: `Password reset successfully for user #${id}.` };
  }
}
