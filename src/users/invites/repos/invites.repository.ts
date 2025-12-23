import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from '../entity/invite.entity';

@Injectable()
export class InvitesRepository extends Repository<Invite> {
  constructor(
    @InjectRepository(Invite)
    repository: Repository<Invite>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }
}
