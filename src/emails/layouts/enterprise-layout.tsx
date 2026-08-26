import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export function EnterpriseEmailLayout({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Zebl AMS</Text>
            <Text style={tagline}>Attendance & Leave Management</Text>
          </Section>
          <Heading style={heading}>{title}</Heading>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            This is an automated message from Zebl AMS. Please do not reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f6f8",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: "0",
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const header = { marginBottom: "24px" };
const brand = { color: "#0f172a", fontSize: "18px", fontWeight: "700", margin: "0" };
const tagline = { color: "#64748b", fontSize: "12px", margin: "4px 0 0" };
const heading = { color: "#0f172a", fontSize: "22px", fontWeight: "600", margin: "0 0 20px" };
const hr = { borderColor: "#e2e8f0", margin: "28px 0 16px" };
const footer = { color: "#94a3b8", fontSize: "11px", lineHeight: "16px", margin: "0" };
