import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthProvider } from '../entity/auth-provider.entity';
import { OAuthProvider } from '../enum/oauth-provider.enum';

@Injectable()
export class AuthProvidersRepository extends Repository<AuthProvider> {
  constructor(dataSource: DataSource) {
    super(AuthProvider, dataSource.createEntityManager());
  }

  async findByProviderAndAuthProviderId(
    provider: OAuthProvider,
    authProviderId: string,
  ): Promise<AuthProvider | null> {
    return this.findOne({
      where: { provider, authProviderId },
      relations: { user: true },
    });
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<AuthProvider | null> {
    return this.findOne({
      where: { userId, provider },
    });
  }
}
