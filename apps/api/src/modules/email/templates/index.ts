interface BaseEmailParams {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function renderBaseLayout(params: BaseEmailParams): string {
  const ctaSection = params.ctaText && params.ctaUrl
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td align="left">
            <a href="${params.ctaUrl}" target="_blank" style="display: inline-block; background-color: #D8EC8D; color: #171e00; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; line-height: 1; padding: 14px 28px; text-decoration: none; border-radius: 9999px; letter-spacing: 0.02em;">
              ${params.ctaText}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #131313; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; }
    a { color: #D8EC8D; text-decoration: underline; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #131313; -webkit-text-size-adjust: 100%;">
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${params.preheader || params.title}
  </div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #131313; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #1c1b1b; border: 1px solid #2a2a2a; border-radius: 20px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #242424;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">SMM PANEL</span>
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #D8EC8D; margin-left: 4px; vertical-align: middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-family: monospace; font-size: 10px; color: #c7c8b6; text-transform: uppercase; letter-spacing: 0.08em;">Official Dispatch</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 28px 32px; color: #e2e3d8; font-size: 14px; line-height: 1.6;">
              <h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.01em;">${params.title}</h1>
              ${params.bodyHtml}
              ${ctaSection}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px 32px; background-color: #161616; border-top: 1px solid #242424; font-size: 11px; color: #8a8b7e; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">This is an automated operational notification regarding your account. Please do not reply directly to this address.</p>
              <p style="margin: 0;">SMM Panel Services • Automated Infrastructure Node</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 1. Verify Email
export function getVerifyEmailTemplate(params: { name: string; verifyUrl: string; expiresHours: number }) {
  const subject = "Verify your email address";
  const html = renderBaseLayout({
    title: "Verify your email address",
    preheader: "Confirm your email address to activate your SMM Panel account.",
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 12px 0;">Thank you for registering. To confirm your identity and activate your account credentials, please use the button below to verify your email address.</p>
      <p style="margin: 0 0 12px 0; color: #c7c8b6; font-size: 12px;">This single-use link will expire in ${params.expiresHours} hours.</p>
      <p style="margin: 16px 0 0 0; color: #8a8b7e; font-size: 11px; word-break: break-all;">If the button does not work, copy and paste this link into your browser:<br><a href="${params.verifyUrl}" style="color: #D8EC8D;">${params.verifyUrl}</a></p>
    `,
    ctaText: "Verify Email Address",
    ctaUrl: params.verifyUrl,
  });

  const text = `Hello ${params.name},

Thank you for registering. To verify your email address and activate your account, open the following link:
${params.verifyUrl}

This link is valid for ${params.expiresHours} hours and can only be used once.

SMM Panel Infrastructure`;

  return { subject, html, text };
}

// 2. Password Reset
export function getPasswordResetTemplate(params: { name: string; resetUrl: string; expiresMinutes: number }) {
  const subject = "Password reset instructions";
  const html = renderBaseLayout({
    title: "Reset your password",
    preheader: "A request was received to reset your SMM Panel password.",
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 12px 0;">We received a request to reset the password associated with your account. If you submitted this request, click the button below to specify your new credentials.</p>
      <p style="margin: 0 0 12px 0; color: #c7c8b6; font-size: 12px;">This recovery link expires in ${params.expiresMinutes} minutes and can only be used once.</p>
      <p style="margin: 0 0 12px 0; color: #ffb4ab; font-size: 12px;">If you did not request a password reset, you can safely disregard this message. Your current password remains secure.</p>
      <p style="margin: 16px 0 0 0; color: #8a8b7e; font-size: 11px; word-break: break-all;">Direct link:<br><a href="${params.resetUrl}" style="color: #D8EC8D;">${params.resetUrl}</a></p>
    `,
    ctaText: "Reset Password",
    ctaUrl: params.resetUrl,
  });

  const text = `Hello ${params.name},

We received a request to reset your password. Use the link below to set a new password:
${params.resetUrl}

This link expires in ${params.expiresMinutes} minutes and can only be used once.

If you did not request this, you can safely ignore this email.

SMM Panel Infrastructure`;

  return { subject, html, text };
}

// 3. Welcome
export function getWelcomeTemplate(params: { name: string; dashboardUrl: string }) {
  const subject = "Welcome to SMM Panel";
  const html = renderBaseLayout({
    title: "Account Activated",
    preheader: "Your account is active. Access your dashboard and catalog.",
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 12px 0;">Welcome to SMM Panel. Your account is confirmed and ready for use. You can now access your dashboard, review catalog services, fund your INR wallet, and monitor active orders in real time.</p>
      <div style="background-color: #242424; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 12px;">
        <p style="margin: 0 0 8px 0; color: #ffffff; font-weight: 600;">Account Capabilities:</p>
        <p style="margin: 0 0 4px 0; color: #c7c8b6;">• Real-time order dispatch and provider tracking</p>
        <p style="margin: 0 0 4px 0; color: #c7c8b6;">• High-precision INR wallet ledger</p>
        <p style="margin: 0; color: #c7c8b6;">• Reseller REST API with key authentication</p>
      </div>
    `,
    ctaText: "Open Dashboard",
    ctaUrl: params.dashboardUrl,
  });

  const text = `Hello ${params.name},

Welcome to SMM Panel. Your account is confirmed and ready for use.
Access your dashboard here: ${params.dashboardUrl}

SMM Panel Infrastructure`;

  return { subject, html, text };
}

// 4. Wallet Credited (Payment Receipt)
export function getWalletCreditedTemplate(params: {
  name: string;
  amountFormatted: string;
  orderId: string;
  newBalanceFormatted: string;
  walletUrl: string;
}) {
  const subject = `Payment receipt: ${params.amountFormatted} credited to your wallet`;
  const html = renderBaseLayout({
    title: "Wallet Credit Receipt",
    preheader: `Deposit confirmed: ${params.amountFormatted} has been credited to your wallet.`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 16px 0;">Your deposit has been successfully processed and credited to your wallet ledger.</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #242424; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Amount Credited:</td>
          <td align="right" style="padding: 6px 0; color: #D8EC8D; font-weight: 700; font-size: 15px;">${params.amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Reference ID:</td>
          <td align="right" style="padding: 6px 0; color: #ffffff; font-family: monospace; font-size: 11px;">${params.orderId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Updated Balance:</td>
          <td align="right" style="padding: 6px 0; color: #ffffff; font-weight: 600;">${params.newBalanceFormatted}</td>
        </tr>
      </table>
    `,
    ctaText: "View Wallet Ledger",
    ctaUrl: params.walletUrl,
  });

  const text = `Hello ${params.name},

Your deposit of ${params.amountFormatted} has been credited to your wallet ledger.
Transaction Reference: ${params.orderId}
Updated Balance: ${params.newBalanceFormatted}

View your wallet: ${params.walletUrl}

SMM Panel Infrastructure`;

  return { subject, html, text };
}

// 5. Order Refunded
export function getOrderRefundTemplate(params: {
  name: string;
  orderId: string;
  amountFormatted: string;
  reason: string;
  ordersUrl: string;
}) {
  const subject = `Order refund: ${params.amountFormatted} credited for Order #${params.orderId.slice(0, 8)}`;
  const html = renderBaseLayout({
    title: "Order Refund Processed",
    preheader: `Refund notice: ${params.amountFormatted} returned to your wallet.`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 16px 0;">A refund has been issued and credited back to your wallet balance for Order #${params.orderId}.</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #242424; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Order ID:</td>
          <td align="right" style="padding: 6px 0; color: #ffffff; font-family: monospace; font-size: 11px;">${params.orderId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Refund Amount:</td>
          <td align="right" style="padding: 6px 0; color: #D8EC8D; font-weight: 700; font-size: 15px;">${params.amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #c7c8b6;">Reason:</td>
          <td align="right" style="padding: 6px 0; color: #ffffff;">${params.reason}</td>
        </tr>
      </table>
    `,
    ctaText: "Review Orders",
    ctaUrl: params.ordersUrl,
  });

  const text = `Hello ${params.name},

A refund of ${params.amountFormatted} has been credited to your wallet for Order #${params.orderId}.
Reason: ${params.reason}

Review your orders: ${params.ordersUrl}

SMM Panel Infrastructure`;

  return { subject, html, text };
}

// 6. Support Ticket Reply
export function getSupportReplyTemplate(params: {
  name: string;
  ticketId: string;
  subject: string;
  replyExcerpt: string;
  ticketUrl: string;
}) {
  const emailSubject = `Support reply: Ticket #${params.ticketId.slice(0, 8)} - ${params.subject}`;
  const html = renderBaseLayout({
    title: "New Support Reply",
    preheader: `New reply on ticket: ${params.subject}`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hello ${params.name},</p>
      <p style="margin: 0 0 16px 0;">A member of our support team has replied to your ticket regarding <strong>${params.subject}</strong>.</p>
      <div style="background-color: #242424; border-left: 3px solid #D8EC8D; border-radius: 0 12px 12px 0; padding: 16px; margin: 16px 0; font-size: 13px; color: #e2e3d8; line-height: 1.5;">
        ${params.replyExcerpt}
      </div>
      <p style="margin: 12px 0 0 0; color: #c7c8b6; font-size: 12px;">To view the complete thread or submit additional information, open the ticket link below.</p>
    `,
    ctaText: "View Support Ticket",
    ctaUrl: params.ticketUrl,
  });

  const text = `Hello ${params.name},

A new response has been posted on Support Ticket #${params.ticketId} (${params.subject}):

"${params.replyExcerpt}"

View the full ticket thread: ${params.ticketUrl}

SMM Panel Support`;

  return { subject: emailSubject, html, text };
}
