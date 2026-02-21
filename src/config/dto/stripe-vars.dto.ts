import { IsOptional, IsString, IsUrl } from 'class-validator';

export class StripeVars {
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  STRIPE_PRICE_ID_PRO?: string;

  @IsUrl()
  @IsOptional()
  STRIPE_SUCCESS_URL?: string;

  @IsUrl()
  @IsOptional()
  STRIPE_CANCEL_URL?: string;
}

export const getStripeConfig = (config: StripeVars) => ({
  secretKey: config.STRIPE_SECRET_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
  prices: { pro: config.STRIPE_PRICE_ID_PRO },
  redirects: {
    successUrl: config.STRIPE_SUCCESS_URL,
    cancelUrl: config.STRIPE_CANCEL_URL,
  },
});
