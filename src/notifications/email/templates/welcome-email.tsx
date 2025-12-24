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
import * as React from 'react';
import { button, container, h1, main, text } from './email-styles';

interface WelcomeEmailProps {
  name: string;
  webAppUrl: string;
}

export const WelcomeEmailTemplate = ({
  name,
  webAppUrl,
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to NestJS Template!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to NestJS Template, {name}!</Heading>
        <Text style={text}>
          We're thrilled to have you on board. Our platform is designed to help.
        </Text>
        <Text style={text}>
          To get started, we recommend exploring your dashboard and setting up
          your profile.
        </Text>
        <Button style={button} href={webAppUrl + '/login'}>
          Go to Your Dashboard
        </Button>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmailTemplate;
