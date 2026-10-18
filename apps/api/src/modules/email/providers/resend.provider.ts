import { EmailProvider, EmailSendOptions, EmailSendResult } from "../email.interface";

export class ResendProvider implements EmailProvider {
  public readonly name = "Resend";
  private apiKey: string;
  private defaultFrom: string;
  private defaultReplyTo?: string;

  constructor(apiKey: string, defaultFrom?: string, defaultReplyTo?: string) {
    this.apiKey = apiKey.trim();
    this.defaultFrom = defaultFrom || "SMM Panel <no-reply@smmpanel.internal>";
    this.defaultReplyTo = defaultReplyTo;
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const from = this.defaultFrom;
    const replyTo = options.replyTo || this.defaultReplyTo;

    const payload: Record<string, any> = {
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        const errorMsg = data?.message || `Resend API error with HTTP ${response.status}`;
        return {
          success: false,
          statusCode: response.status,
          error: errorMsg,
        };
      }

      return {
        success: true,
        messageId: data.id,
        statusCode: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to communicate with Resend API",
      };
    }
  }
}
