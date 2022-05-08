import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from './assemblies/assemblies.module'
import { AuthenticationModule } from './authentication/authentication.module'
import { ChangesModule } from './changes/changes.module'
import { FeaturesModule } from './features/features.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
import { FilesModule } from './files/files.module'
import { RefSeqChunksModule } from './refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from './refSeqs/refSeqs.module'
import { RolesGuard } from './utils/role/role.guards'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
