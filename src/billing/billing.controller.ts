import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBody,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Public } from '@/core/decorators/public.decorator';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { SanitizedUser } from '@/users/entity/user.entity';
import { CheckoutSessionResponseDto } from './dto/checkout-session.dto';
import { PortalSessionResponseDto } from './dto/portal-session.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { Subscription } from './entity/subscription.entity';
import { BillingService } from './services/billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly logger: ContextLogger,
  ) {}

  @Post('checkout')
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Create a Stripe Checkout Session for the Pro plan',
  })
  @ApiOkResponse({ type: CheckoutSessionResponseDto })
  createCheckout(@CurrentUser() user: SanitizedUser): Promise<{ url: string }> {
    return this.billingService.createCheckoutSession(user);
  }

  @Post('portal')
  @ApiJwtAuth()
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session' })
  @ApiOkResponse({ type: PortalSessionResponseDto })
  createPortal(@CurrentUser() user: SanitizedUser): Promise<{ url: string }> {
    return this.billingService.createPortalSession(user);
  }

  @Get('subscription')
  @ApiJwtAuth()
  @ApiOperation({ summary: 'Get current user subscription status' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  getSubscription(
    @CurrentUser() user: SanitizedUser,
  ): Promise<Subscription | null> {
    return this.billingService.getSubscription(user.id);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook — @Public, verified via Stripe signature',
  })
  @ApiBody({
    schema: { type: 'object' },
    description: 'Stripe event payload (raw body)',
  })
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: import('stripe').default.Event;
    try {
      event = this.billingService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn('Stripe webhook signature verification failed', {
        err,
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.billingService.handleWebhookEvent(event);
    return { received: true };
  }
}
