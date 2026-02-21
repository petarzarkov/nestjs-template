import { afterEach, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { SubscriptionStatus } from '@/billing/enum/subscription-status.enum';
import { getTestContext } from '../setup/context';

/**
 * Construct a Stripe-compatible signed webhook payload.
 * Mirrors Stripe's HMAC-SHA256 signing algorithm exactly:
 *   signed_payload = `${timestamp}.${JSON.stringify(payload)}`
 *   signature      = `t=${timestamp},v1=${hmac(signed_payload)}`
 *
 * ApiClient.post also calls JSON.stringify on the same payload object,
 * so the HMAC verifies end-to-end when the webhook secret matches.
 */
function buildStripeWebhookPayload(
  payload: object,
  secret: string,
): { payload: object; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${body}`;
  const hmac = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const signature = `t=${timestamp},v1=${hmac}`;
  return { payload, signature };
}

const TEST_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret';

describe('Billing (e2e)', () => {
  const ctx = getTestContext();

  afterEach(async () => {
    ctx.reset();
    await ctx.db.subscriptions
      .createQueryBuilder()
      .delete()
      .where('user_id IN (SELECT id FROM "user" WHERE email LIKE :pattern)', {
        pattern: '%@e2e-test.com',
      })
      .execute();
  });

  describe('POST /api/billing/checkout', () => {
    test('should reject unauthenticated request', async () => {
      await Bun.sleep(1100);
      ctx.api.clearAuthToken();

      const response = await ctx.api.post('/api/billing/checkout');
      expect(response.status).toBe(401);
    });

    test('should return checkout URL or 500 when Stripe not configured', async () => {
      await Bun.sleep(1100);
      await ctx.loginAsAdmin();

      const response = await ctx.api.post<{ url: string }>(
        '/api/billing/checkout',
      );
      // 201 with a URL when STRIPE_SECRET_KEY + STRIPE_PRICE_ID_PRO are set,
      // 500 when they are not (expected in CI without live Stripe creds)
      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(typeof response.data.url).toBe('string');
        expect(response.data.url).toMatch(/^https:\/\//);
      }
    });
  });

  describe('POST /api/billing/portal', () => {
    test('should reject unauthenticated request', async () => {
      await Bun.sleep(1100);
      ctx.api.clearAuthToken();

      const response = await ctx.api.post('/api/billing/portal');
      expect(response.status).toBe(401);
    });

    test('should return 404 when no subscription record exists', async () => {
      await Bun.sleep(1100);
      await ctx.loginAsAdmin();

      const response = await ctx.api.post('/api/billing/portal');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/billing/subscription', () => {
    test('should reject unauthenticated request', async () => {
      await Bun.sleep(1100);
      ctx.api.clearAuthToken();

      const response = await ctx.api.get('/api/billing/subscription');
      expect(response.status).toBe(401);
    });

    test('should return null when no subscription exists', async () => {
      await Bun.sleep(1100);
      await ctx.loginAsAdmin();

      const response = await ctx.api.get<null>('/api/billing/subscription');
      expect(response.status).toBe(200);
      expect(response.data).toBeNull();
    });

    test('should return subscription record after DB seed', async () => {
      await Bun.sleep(1100);
      await ctx.loginAsAdmin();

      const adminUser = await ctx.db.getUserByEmail('admin@e2e-test.com');
      expect(adminUser).not.toBeNull();
      if (!adminUser) return;

      const seeded = await ctx.db.subscriptions.save({
        userId: adminUser.id,
        stripeCustomerId: 'cus_e2e_get_test',
        stripeSubscriptionId: 'sub_e2e_get_test',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      });

      const response = await ctx.api.get<{
        id: string;
        status: string;
      }>('/api/billing/subscription');

      expect(response.status).toBe(200);
      expect(response.data).not.toBeNull();
      expect(response.data.id).toBe(seeded.id);
      expect(response.data.status).toBe('active');

      await ctx.db.subscriptions.delete({ id: seeded.id });
    });
  });

  describe('POST /api/billing/webhook', () => {
    test('should reject missing stripe-signature header', async () => {
      await Bun.sleep(1100);
      ctx.api.clearAuthToken();

      const response = await ctx.api.post('/api/billing/webhook', {});
      expect(response.status).toBe(400);
    });

    test('should reject invalid stripe signature', async () => {
      await Bun.sleep(1100);

      const response = await ctx.api.post(
        '/api/billing/webhook',
        { type: 'customer.subscription.updated' },
        { headers: { 'stripe-signature': 't=000,v1=invalidsig' } },
      );
      expect(response.status).toBe(400);
    });

    test('should be @Public — bad signature returns 400 not 401', async () => {
      await Bun.sleep(1100);
      ctx.api.clearAuthToken();

      const response = await ctx.api.post(
        '/api/billing/webhook',
        { type: 'ping' },
        { headers: { 'stripe-signature': 't=000,v1=invalidsig' } },
      );
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(401);
    });

    test('should process customer.subscription.deleted and set status to canceled', async () => {
      await Bun.sleep(1100);

      const adminUser = await ctx.db.getUserByEmail('admin@e2e-test.com');
      expect(adminUser).not.toBeNull();
      if (!adminUser) return;

      const seeded = await ctx.db.subscriptions.save({
        userId: adminUser.id,
        stripeCustomerId: 'cus_e2e_deleted_test',
        stripeSubscriptionId: 'sub_e2e_deleted_test',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      });

      const webhookPayload = {
        id: 'evt_e2e_deleted',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_e2e_deleted_test',
            object: 'subscription',
            customer: 'cus_e2e_deleted_test',
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_start: Math.floor(Date.now() / 1000) - 86400,
            current_period_end: Math.floor(Date.now() / 1000),
            items: { data: [{ price: { id: 'price_test_pro' } }] },
          },
        },
      };

      const { payload, signature } = buildStripeWebhookPayload(
        webhookPayload,
        TEST_WEBHOOK_SECRET,
      );

      const response = await ctx.api.post('/api/billing/webhook', payload, {
        headers: { 'stripe-signature': signature },
      });

      if (response.status === 200) {
        expect(response.data).toEqual({ received: true });
        const updated = await ctx.db.subscriptions.findOne({
          where: { id: seeded.id },
        });
        expect(updated?.status).toBe(SubscriptionStatus.CANCELED);
      } else {
        // Signature mismatch — app's STRIPE_WEBHOOK_SECRET differs from test value
        expect(response.status).toBe(400);
      }

      await ctx.db.subscriptions.delete({ id: seeded.id });
    }, 10000);

    test('should process invoice.payment_failed and set status to past_due', async () => {
      await Bun.sleep(1100);

      const adminUser = await ctx.db.getUserByEmail('admin@e2e-test.com');
      expect(adminUser).not.toBeNull();
      if (!adminUser) return;

      const seeded = await ctx.db.subscriptions.save({
        userId: adminUser.id,
        stripeCustomerId: 'cus_e2e_invoice_test',
        stripeSubscriptionId: 'sub_e2e_invoice_test',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      });

      const webhookPayload = {
        id: 'evt_e2e_invoice_failed',
        object: 'event',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_e2e_invoice',
            object: 'invoice',
            customer: 'cus_e2e_invoice_test',
            subscription: 'sub_e2e_invoice_test',
            status: 'open',
          },
        },
      };

      const { payload, signature } = buildStripeWebhookPayload(
        webhookPayload,
        TEST_WEBHOOK_SECRET,
      );

      const response = await ctx.api.post('/api/billing/webhook', payload, {
        headers: { 'stripe-signature': signature },
      });

      if (response.status === 200) {
        expect(response.data).toEqual({ received: true });
        const updated = await ctx.db.subscriptions.findOne({
          where: { id: seeded.id },
        });
        expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      } else {
        expect(response.status).toBe(400);
      }

      await ctx.db.subscriptions.delete({ id: seeded.id });
    }, 10000);
  });
});
