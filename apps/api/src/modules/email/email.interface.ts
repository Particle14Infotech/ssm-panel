export type EmailType =
  | "VERIFY_EMAIL"
  | "PASSWORD_RESET"
  | "WELCOME"
  | "PAYMENT_RECEIPT"
  | "ORDER_REFUND"
  | "SUPPORT_REPLY";

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: EmailType;
  userId?: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

export interface EmailProvider {
  name: string;
  send(options: EmailSendOptions): Promise<EmailSendResult>;
}
