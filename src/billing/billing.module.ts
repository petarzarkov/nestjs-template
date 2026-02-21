import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/db/database.module';
import { BillingController } from './billing.controller';
import { Subscription } from './entity/subscription.entity';
import { ActiveSubscriptionGuard } from './guards/active-subscription.guard';
import { SubscriptionRepository } from './repos/subscription.repository';
import { BillingService } from './services/billing.service';

@Module({
  imports: [DatabaseModule.forFeature([Subscription])],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionRepository, ActiveSubscriptionGuard],
  exports: [BillingService, SubscriptionRepository, ActiveSubscriptionGuard],
})
export class BillingModule {}
