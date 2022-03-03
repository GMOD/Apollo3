import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'

import { AuthenticationModule } from './authentication/authentication.module'
import { ChangeModule } from './change/change.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
import { RolesGuard } from './utils/role/role.guards'

import { MongooseModule } from '@nestjs/mongoose'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    FileHandlingModule,
    ChangeModule,
    MongooseModule.forRoot(
      'mongodb+srv://apollo:apollo123@cluster0.8a7mi.mongodb.net/apolloDb?retryWrites=true&w=majority'
    )
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
