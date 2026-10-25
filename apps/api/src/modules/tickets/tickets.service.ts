import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException, Optional } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService
  ) {}

  async create(userId: string, body: { subject: string; message: string; priority?: string }) {
    if (!userId) {
      throw new BadRequestException("Authenticated user ID is required to create a ticket.");
    }
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        subject: body.subject,
        priority: body.priority || "NORMAL",
        status: "OPEN",
        messages: {
          create: {
            senderId: userId,
            message: body.message,
          },
        },
      },
      include: { messages: true },
    });
    return { success: true, ticketId: ticket.id, ticket };
  }

  async findAll(userId?: string, requesterRole?: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    try {
      const where = requesterRole === "ADMIN" ? (userId ? { userId } : {}) : (userId ? { userId } : { userId: "none" });
      return await this.prisma.ticket.findMany({
        where,
        include: {
          messages: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    } catch {
      return [];
    }
  }

  async findOne(id: string, requesterUserId?: string, requesterRole?: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} not found.`);

    if (requesterRole !== "ADMIN" && (!requesterUserId || ticket.userId !== requesterUserId)) {
      throw new NotFoundException(`Ticket #${id} not found.`);
    }

    return ticket;
  }

  async reply(id: string, senderId: string, message: string, requesterRole?: string) {
    const existing = await this.findOne(id, senderId, requesterRole);
    if (!this.prisma.isConnected) {
      const msg = {
        id: `msg-${Date.now()}`,
        ticketId: id,
        senderId,
        message,
        createdAt: new Date(),
      };
      existing.messages = existing.messages || [];
      existing.messages.push(msg);
      existing.status = "ANSWERED";
      existing.updatedAt = new Date();
      return { success: true, message: msg };
    }
    const msg = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId,
        message,
      },
    });
    await this.prisma.ticket.update({
      where: { id },
      data: { updatedAt: new Date(), status: "ANSWERED" },
    });

    if (this.emailService && senderId !== existing.userId) {
      this.prisma.user.findUnique({ where: { id: existing.userId } }).then((recipient) => {
        if (recipient) {
          this.emailService!.sendSupportReplyEmail(
            recipient,
            id,
            existing.subject,
            message
          ).catch(() => null);
        }
      }).catch(() => null);
    }

    return { success: true, message: msg };
  }

  async close(id: string, requesterUserId?: string, requesterRole?: string) {
    const existing = await this.findOne(id, requesterUserId, requesterRole);
    if (!this.prisma.isConnected) {
      existing.status = "CLOSED";
      existing.updatedAt = new Date();
      return { success: true, message: `Ticket #${id} closed.`, ticket: existing };
    }
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    return { success: true, message: `Ticket #${id} closed.`, ticket: updated };
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status },
    });
    return { success: true, ticket: updated };
  }
}

