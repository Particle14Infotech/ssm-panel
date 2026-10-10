import { z } from "zod";

export const TicketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TicketStatusSchema = z.enum(["OPEN", "ANSWERED", "CUSTOMER_REPLY", "IN_REVIEW", "RESOLVED", "CLOSED"]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TicketDepartmentSchema = z.enum([
  "ORDER_ISSUES",
  "PAYMENT_BILLING",
  "SERVICE_REFILL",
  "API_INTEGRATION",
  "GENERAL_SUPPORT",
]);
export type TicketDepartment = z.infer<typeof TicketDepartmentSchema>;

export const TicketMessageSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorRole: z.enum(["USER", "ADMIN", "SUPPORT_AGENT", "SYSTEM"]),
  content: z.string(),
  attachments: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type TicketMessage = z.infer<typeof TicketMessageSchema>;

export const TicketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  department: TicketDepartmentSchema,
  priority: TicketPrioritySchema,
  status: TicketStatusSchema,
  orderId: z.string().optional(),
  lastReplyAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(TicketMessageSchema).default([]),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const CreateTicketInputSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  department: TicketDepartmentSchema,
  priority: TicketPrioritySchema.default("MEDIUM"),
  orderId: z.string().optional(),
  message: z.string().min(10, "Message must provide sufficient detail (at least 10 characters)"),
  attachments: z.array(z.string()).optional(),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export const ReplyTicketInputSchema = z.object({
  ticketId: z.string(),
  message: z.string().min(2, "Reply message cannot be empty"),
  attachments: z.array(z.string()).optional(),
});
export type ReplyTicketInput = z.infer<typeof ReplyTicketInputSchema>;
