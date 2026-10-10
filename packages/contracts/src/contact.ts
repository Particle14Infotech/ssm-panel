import { z } from "zod";

export const ContactMessageSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  company: z.string().optional(),
  // Honeypot field for spam prevention
  _hp: z.string().max(0, "Bot detected").optional(),
});
export type ContactMessageInput = z.infer<typeof ContactMessageSchema>;

export const ContactResponseSchema = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  message: z.string(),
});
export type ContactResponse = z.infer<typeof ContactResponseSchema>;
