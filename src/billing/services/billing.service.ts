import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { SanitizedUser } from '@/users/entity/user.entity';
import { Subscription } from '../entity/subscription.entity';
import { SubscriptionStatus } from '../enum/subscription-status.enum';
import { SubscriptionRepository } from '../repos/subscription.repository';

@Injectable()
export class BillingService {
  private readonly stripeClient: Stripe | null;
  private readonly webhookSecret: string;
  private readonly priceIdPro: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly logger: ContextLogger,
  ) {
    const stripeConfig = this.configService.getOrThrow('stripe');

    this.stripeClient = stripeConfig.secretKey
      ? new Stripe(stripeConfig.secretKey, {
          apiVersion: '2026-01-28.clover',
          typescript: true,
        })
      : null;

    this.webhookSecret = stripeConfig.webhookSecret ?? '';
    this.priceIdPro = stripeConfig.prices?.pro ?? '';
    this.successUrl = stripeConfig.redirects?.successUrl ?? '';
    this.cancelUrl = stripeConfig.redirects?.cancelUrl ?? '';
  }

  private get stripe(): Stripe {
    if (!this.stripeClient) {
      throw new InternalServerErrorException(
        'STRIPE_SECRET_KEY is not configured',
      );
    }
    return this.stripeClient;
  }

  async getOrCreateCustomer(user: SanitizedUser): Promise<string> {
    const existing = await this.subscriptionRepo.findByUserId(user.id);
    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.displayName ?? user.email,
      metadata: { userId: user.id },
    });

    const sub = existing ?? this.subscriptionRepo.create({ userId: user.id });
    sub.stripeCustomerId = customer.id;
    await this.subscriptionRepo.save(sub);

    return customer.id;
  }

  async createCheckoutSession(user: SanitizedUser): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(user);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: this.priceIdPro, quantity: 1 }],
      mode: 'subscription',
      success_url: this.successUrl,
      cancel_url: this.cancelUrl,
      metadata: { userId: user.id },
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a checkout URL',
      );
    }

    return { url: session.url };
  }

  async createPortalSession(user: SanitizedUser): Promise<{ url: string }> {
    const subscription = await this.subscriptionRepo.findByUserId(user.id);
    if (!subscription?.stripeCustomerId) {
      throw new NotFoundException(
        'No billing record found. Please start a subscription first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: this.successUrl,
    });

    return { url: session.url };
  }

  getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findByUserId(userId);
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Handling Stripe webhook: ${event.type}`, {
      eventId: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      default:
        this.logger.verbose(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.mode !== 'subscription' || !session.subscription) return;

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const stripeSubscription =
      await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (!customerId) return;

    const existing =
      await this.subscriptionRepo.findByStripeCustomerId(customerId);
    if (!existing) {
      this.logger.warn('No subscription record for customer', { customerId });
      return;
    }

    const firstItem = stripeSubscription.items.data[0];
    existing.stripeSubscriptionId = stripeSubscriptionId;
    existing.stripePriceId = firstItem?.price.id ?? null;
    existing.status = stripeSubscription.status as SubscriptionStatus;
    existing.currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    existing.currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;
    existing.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

    await this.subscriptionRepo.save(existing);
    this.logger.log('Subscription activated via checkout', {
      customerId,
      subscriptionId: stripeSubscriptionId,
    });
  }

  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.subscriptionRepo.findByStripeSubscriptionId(
      stripeSubscription.id,
    );
    if (!existing) return;

    const firstItem = stripeSubscription.items.data[0];
    existing.status = stripeSubscription.status as SubscriptionStatus;
    existing.stripePriceId = firstItem?.price.id ?? null;
    existing.currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    existing.currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;
    existing.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

    await this.subscriptionRepo.save(existing);
  }

  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.subscriptionRepo.findByStripeSubscriptionId(
      stripeSubscription.id,
    );
    if (!existing) return;

    existing.status = SubscriptionStatus.CANCELED;
    existing.cancelAtPeriodEnd = false;
    await this.subscriptionRepo.save(existing);
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id;

    if (!subscriptionId) return;

    const existing =
      await this.subscriptionRepo.findByStripeSubscriptionId(subscriptionId);
    if (!existing) return;

    existing.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionRepo.save(existing);
  }
}
