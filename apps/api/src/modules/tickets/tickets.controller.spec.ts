import { Test, TestingModule } from "@nestjs/testing";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

describe("TicketsController Unit Tests", () => {
  let controller: TicketsController;
  let mockTicketsService: Partial<TicketsService>;

  beforeEach(async () => {
    mockTicketsService = {
      findAll: jest.fn().mockResolvedValue([
        { id: "tkt_1", subject: "Order delayed", status: "OPEN" },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: "tkt_1",
        subject: "Order delayed",
        status: "OPEN",
        messages: [{ sender: "CUSTOMER", message: "Help please" }],
      }),
      create: jest.fn().mockResolvedValue({
        success: true,
        ticket: { id: "tkt_2", subject: "Refund inquiry", status: "OPEN" },
      }),
      reply: jest.fn().mockResolvedValue({
        success: true,
        message: { id: "msg_1", message: "We are checking" },
      }),
      close: jest.fn().mockResolvedValue({
        success: true,
        ticket: { id: "tkt_1", status: "CLOSED" },
      }),
      updateStatus: jest.fn().mockResolvedValue({
        success: true,
        ticket: { id: "tkt_1", status: "RESOLVED" },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: mockTicketsService }],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it("lists tickets for customer", async () => {
    const list = await controller.findAll("usr_1");
    expect(list.length).toBe(1);
    expect(mockTicketsService.findAll).toHaveBeenCalledWith("usr_1", undefined);
  });

  it("creates ticket with canonical endpoint", async () => {
    const res = await controller.createCanonical({ subject: "Refund inquiry" }, "usr_1");
    expect(res.success).toBe(true);
    expect(res.ticket.id).toBe("tkt_2");
  });

  it("replies to an existing ticket", async () => {
    const res = await controller.reply("tkt_1", "We are checking", "usr_admin");
    expect(res.success).toBe(true);
  });

  it("closes an active ticket", async () => {
    const res = await controller.close("tkt_1");
    expect(res.ticket.status).toBe("CLOSED");
  });

  it("updates ticket status administratively", async () => {
    const res = await controller.updateStatus("tkt_1", "RESOLVED");
    expect(res.ticket.status).toBe("RESOLVED");
  });
});
