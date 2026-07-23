import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { renderNotificationEmail } from "@/emails/render-email";
import {
  parseNotificationPayload,
  type ChannelDeliveryResult,
  type NotificationChannelHandler,
} from "@/lib/notifications/notification-types";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return transporter;
}

export class EmailNotificationChannel implements NotificationChannelHandler {
  readonly channel = NotificationChannel.email;

  async send(notification: {
    id: string;
    type: NotificationType;
    recipient: string;
    subject: string;
    payload: string;
  }): Promise<ChannelDeliveryResult> {
    const transport = getTransporter();
    if (!transport) {
      if (process.env.NODE_ENV === "development") {
        console.info(
          `[notifications] SMTP not configured — skipping email to ${notification.recipient}: ${notification.subject}`
        );
        return { success: true, providerMessageId: "dev-skip" };
      }
      return { success: false, error: "SMTP is not configured" };
    }

    try {
      const data = parseNotificationPayload(notification.payload);
      const { html, text } = await renderNotificationEmail(notification.type, data);

      const from = process.env.EMAIL_FROM ?? "Zebl AMS <noreply@zebl.local>";
      const result = await transport.sendMail({
        from,
        to: notification.recipient,
        subject: notification.subject,
        html,
        text,
      });

      return {
        success: true,
        providerMessageId: result.messageId,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email send failed";
      return { success: false, error: message };
    }
  }
}

export const emailChannel = new EmailNotificationChannel();
