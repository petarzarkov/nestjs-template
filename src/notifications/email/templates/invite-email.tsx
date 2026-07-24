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
import type { InvitePayload } from '@/notifications/dto/user-notifications.dto';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { button, container, h1, main, text } from './email-styles';

interface InviteEmailProps extends InvitePayload {
  inviteUrl: string;
}

// Sample data for the `react-email` dev preview / export (`bun run email`).
// Doubles as the render-time fallback so the CLI (which renders with empty
// props) never dereferences `undefined`; real callers still pass full props.
const previewProps: InviteEmailProps = {
  invite: {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'invitee@example.com',
    inviteCode: 'sample-invite-code',
    role: UserRole.USER,
    status: InviteStatus.PENDING,
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  inviteUrl: 'https://example.com/api/invites/accept?code=sample-invite-code',
};

export function InviteEmailTemplate(props: InviteEmailProps) {
  // Merge over the sample so the `react-email` CLI (which renders with empty
  // props) still gets valid data; real callers always pass the full props.
  const { invite, inviteUrl } = { ...previewProps, ...props };
  return (
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
}

InviteEmailTemplate.PreviewProps = previewProps;

export default InviteEmailTemplate;
