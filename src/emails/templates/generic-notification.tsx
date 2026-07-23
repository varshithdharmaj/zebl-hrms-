import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Heading,
} from "@react-email/components";
import type { NotificationType } from "@/generated/prisma/enums";
import type { NotificationPayload } from "@/lib/notifications/notification-types";

interface GenericNotificationEmailProps {
  type: NotificationType;
  data: NotificationPayload;
}

export function GenericNotificationEmail({ type, data }: GenericNotificationEmailProps) {
  const title = formatNotificationType(type);
  const message = formatMessage(data);

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>{title}</Heading>
            <Hr style={hr} />
            <Text style={text}>{message}</Text>
            
            {Object.entries(data).map(([key, value]) => {
              if (typeof value === "string" || typeof value === "number") {
                return (
                  <Text key={key} style={detail}>
                    <strong>{formatKey(key)}:</strong> {value}
                  </Text>
                );
              }
              return null;
            })}
            
            <Hr style={hr} />
            <Text style={footer}>
              ZEBL Attendance Management System
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function formatNotificationType(type: NotificationType): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatMessage(data: NotificationPayload): string {
  if ("message" in data && typeof data.message === "string") {
    return data.message;
  }
  if ("subject" in data && typeof data.subject === "string") {
    return data.subject;
  }
  return "You have a new notification.";
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const section = {
  padding: "0 48px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.25",
  margin: "16px 0",
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const detail = {
  color: "#525f7f",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "8px 0",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "16px 0",
};
