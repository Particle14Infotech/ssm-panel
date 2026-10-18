import { EmailProvider, EmailSendOptions, EmailSendResult } from "../email.interface";

export class LogOnlyEmailProvider implements EmailProvider {
  public readonly name = "LogOnly";

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const simulatedId = `sim_msg_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    console.log(`[Email:LogOnly] ========================================`);
    console.log(`[Email:LogOnly] Type: ${options.type}`);
    console.log(`[Email:LogOnly] To: ${options.to}`);
    console.log(`[Email:LogOnly] Subject: ${options.subject}`);
    console.log(`[Email:LogOnly] Simulated ID: ${simulatedId}`);
    console.log(`[Email:LogOnly] Body Excerpt: ${options.text.slice(0, 150)}...`);
    console.log(`[Email:LogOnly] ========================================`);

    return {
      success: true,
      messageId: simulatedId,
      statusCode: 200,
    };
  }
}
