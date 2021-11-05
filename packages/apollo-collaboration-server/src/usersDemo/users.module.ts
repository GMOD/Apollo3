import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * DEMO PURPOSE ONLY
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
