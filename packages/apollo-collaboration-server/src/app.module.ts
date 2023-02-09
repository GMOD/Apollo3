import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from './assemblies/assemblies.module'
import { AuthenticationModule } from './authentication/authentication.module'
import { ChangesModule } from './changes/changes.module'
import { CountersModule } from './counters/counters.module'
import { FeaturesModule } from './features/features.module'
import { FilesModule } from './files/files.module'
import { MessagesModule } from './messages/messages.module'
import { OperationsModule } from './operations/operations.module'
import { RefSeqChunksModule } from './refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from './refSeqs/refSeqs.module'
import { UsersModule } from './users/users.module'
import { JwtAuthGuard } from './utils/jwt-auth.guard'
import { ValidationGuard } from './utils/validation/validation.guards'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    AuthenticationModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    ChangesModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AssembliesModule,
    RefSeqChunksModule,
    RefSeqsModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    MessagesModule,
    OperationsModule,
    CountersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ValidationGuard },
  ],
})
export class AppModule {}
