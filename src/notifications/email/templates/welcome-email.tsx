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
import { main, container, h1, text, button } from './email-styles';

interface WelcomeEmailProps {
  name: string;
}

export const WelcomeEmailTemplate = ({ name }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to IISO!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to IISO, {name}!</Heading>
        <Text style={text}>
          We're thrilled to have you on board. Our platform is designed to help
          you manage your digital assets seamlessly and securely.
        </Text>
        <Text style={text}>
          To get started, we recommend exploring your dashboard and setting up
          your profile.
        </Text>
        <Button style={button} href="https://iiso.com/login">
          Go to Your Dashboard
        </Button>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmailTemplate;
