import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import React from 'react';
import { button, container, h1, main, text } from './email-styles';

interface WelcomeEmailProps {
  name: string;
  webAppUrl: string;
}

// Sample data for the `react-email` dev preview / export; doubles as the
// render-time fallback for the CLI (which renders with empty props).
const previewProps: WelcomeEmailProps = {
  name: 'Ada Lovelace',
  webAppUrl: 'https://example.com',
};

export function WelcomeEmailTemplate(props: WelcomeEmailProps) {
  // Merge over the sample so the `react-email` CLI (which renders with empty
  // props) still gets valid data; real callers always pass the full props.
  const { name, webAppUrl } = { ...previewProps, ...props };
  return (
    <Html>
      <Head />
      <Preview>Welcome to NestJS Template!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to NestJS Template, {name}!</Heading>
          <Text style={text}>
            We're thrilled to have you on board. Our platform is designed to
            help.
          </Text>
          <Text style={text}>
            To get started, we recommend exploring your dashboard and setting up
            your profile.
          </Text>
          <Button style={button} href={`${webAppUrl}/login`}>
            Go to Your Dashboard
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmailTemplate.PreviewProps = previewProps;

export default WelcomeEmailTemplate;
