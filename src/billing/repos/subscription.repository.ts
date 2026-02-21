import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entity/subscription.entity';

@Injectable()
export class SubscriptionRepository {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
  ) {}

  findByUserId(userId: string): Promise<Subscription | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Subscription | null> {
    return this.repo.findOne({ where: { stripeCustomerId } });
  }

  findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Subscription | null> {
    return this.repo.findOne({ where: { stripeSubscriptionId } });
  }

  save(subscription: Partial<Subscription>): Promise<Subscription> {
    return this.repo.save(subscription);
  }

  create(data: Partial<Subscription>): Subscription {
    return this.repo.create(data);
  }
}
