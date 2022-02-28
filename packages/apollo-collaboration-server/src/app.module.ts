import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'

import { AuthenticationModule } from './authentication/authentication.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
import { RolesGuard } from './utils/role/role.guards'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    FileHandlingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
