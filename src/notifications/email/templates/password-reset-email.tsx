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
import { button, container, h1, main, section, text } from './email-styles';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
}

export const PasswordResetEmailTemplate = ({
  name,
  resetUrl,
}: PasswordResetEmailProps) => (
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

export default PasswordResetEmailTemplate;
