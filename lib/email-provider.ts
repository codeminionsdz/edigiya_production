export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface DigitalEmailProvider {
  sendEmail(message: EmailMessage): Promise<void>;
}

class UnconfiguredEmailProvider implements DigitalEmailProvider {
  async sendEmail(_message: EmailMessage): Promise<void> {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }
}

class ResendEmailProvider implements DigitalEmailProvider {
  async sendEmail(message: EmailMessage): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
    const replyTo = process.env.EMAIL_REPLY_TO;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('EMAIL_PROVIDER_REQUEST_FAILED');
  }
}

export function getDigitalEmailProvider(): DigitalEmailProvider {
  // Provider selection is server configuration only; client input is ignored.
  if (process.env.EMAIL_PROVIDER === 'resend') return new ResendEmailProvider();
  return new UnconfiguredEmailProvider();
}
