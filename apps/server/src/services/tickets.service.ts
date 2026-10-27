import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";

export class TicketsService {
  constructor(private readonly prisma: PrismaLike) {}

  private get client(): any {
    return this.prisma.client || this.prisma;
  }

  private get isConnected(): boolean {
    return Boolean(this.prisma.isConnected);
  }

  async create(userId: string, body: { subject: string; message: string; priority?: string }) {
    if (!userId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required to create a ticket.");
    }
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    const ticket = await this.client.ticket.create({
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
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    try {
      const where = requesterRole === "ADMIN" ? (userId ? { userId } : {}) : (userId ? { userId } : { userId: "none" });
      return await this.client.ticket.findMany({
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
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    const ticket = await this.client.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw new ApiError(404, "NOT_FOUND", `Ticket #${id} not found.`);

    if (requesterRole !== "ADMIN" && (!requesterUserId || ticket.userId !== requesterUserId)) {
      throw new ApiError(404, "NOT_FOUND", `Ticket #${id} not found.`);
    }

    return ticket;
  }

  async reply(id: string, senderId: string, message: string, requesterRole?: string) {
    const existing = await this.findOne(id, senderId, requesterRole);
    if (!this.isConnected) {
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
    const msg = await this.client.ticketMessage.create({
      data: {
        ticketId: id,
        senderId,
        message,
      },
    });
    await this.client.ticket.update({
      where: { id },
      data: { updatedAt: new Date(), status: "ANSWERED" },
    });

    return { success: true, message: msg };
  }

  async close(id: string, requesterUserId?: string, requesterRole?: string) {
    const existing = await this.findOne(id, requesterUserId, requesterRole);
    if (!this.isConnected) {
      existing.status = "CLOSED";
      existing.updatedAt = new Date();
      return { success: true, message: `Ticket #${id} closed.`, ticket: existing };
    }
    const updated = await this.client.ticket.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    return { success: true, message: `Ticket #${id} closed.`, ticket: updated };
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    const updated = await this.client.ticket.update({
      where: { id },
      data: { status },
    });
    return { success: true, ticket: updated };
  }
}
