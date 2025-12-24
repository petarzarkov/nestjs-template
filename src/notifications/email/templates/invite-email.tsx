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
// biome-ignore lint/correctness/noUnusedImports: File is a module
import React from 'react';
import type { InvitePayload } from '@/notifications/dto/user-notifications.dto';
import { button, container, h1, main, text } from './email-styles';

interface InviteEmailProps extends InvitePayload {
  inviteUrl: string;
}

export const InviteEmailTemplate = ({
  invite,
  inviteUrl,
}: InviteEmailProps) => (
  <Html>
    <Head />
    <Preview>You have been invited to join!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          You have been invited to join {invite.email}!
        </Heading>
        <Text style={text}>
          We're thrilled to have you on board. Our platform is designed.
        </Text>
        <Text style={text}>
          To get started, we recommend you setting up your profile
        </Text>
        <Button style={button} href={inviteUrl}>
          Sign up
        </Button>
      </Container>
    </Body>
  </Html>
);

export default InviteEmailTemplate;
