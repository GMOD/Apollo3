import { CacheModule, Module } from '@nestjs/common'
import { FileHandlingController } from './fileHandling.controller'
import { FileHandlingService } from './fileHandling.service'

// const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  controllers: [FileHandlingController],
  providers: [FileHandlingService],
  imports: [
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
  ],
})
export class FileHandlingModule {}
