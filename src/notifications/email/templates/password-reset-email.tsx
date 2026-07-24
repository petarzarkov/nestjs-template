import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Section,
  Text,
} from '@react-email/components';
import React from 'react';
import { button, container, h1, main, section, text } from './email-styles';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
}

// Sample data for the `react-email` dev preview / export; doubles as the
// render-time fallback for the CLI (which renders with empty props).
const previewProps: PasswordResetEmailProps = {
  name: 'Ada Lovelace',
  resetUrl: 'https://example.com/reset-password?token=sample-reset-token',
};

export function PasswordResetEmailTemplate(props: PasswordResetEmailProps) {
  // Merge over the sample so the `react-email` CLI (which renders with empty
  // props) still gets valid data; real callers always pass the full props.
  const { name, resetUrl } = { ...previewProps, ...props };
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Hello {name},</Heading>
          <Text style={text}>
            We received a request to reset your password. Click the button below
            to set a new password. If you didn&#39;t request this, please ignore
            this email.
          </Text>
          <Section style={section}>
            <Button href={resetUrl} style={button}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            If you&#39;re having trouble clicking the button, copy and paste the
            following link into your browser:
            <br />
            {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

PasswordResetEmailTemplate.PreviewProps = previewProps;

export default PasswordResetEmailTemplate;
