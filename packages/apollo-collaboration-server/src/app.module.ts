import fs from 'node:fs/promises'

import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import {
  MongooseModule,
  type MongooseModuleFactoryOptions,
} from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

import { AssembliesModule } from './assemblies/assemblies.module.js'
import { AssemblyAccessGuard } from './assemblyAccess/assemblyAccess.guard.js'
import { AssemblyAccessModule } from './assemblyAccess/assemblyAccess.module.js'
import { AuthenticationModule } from './authentication/authentication.module.js'
import { ChangesModule } from './changes/changes.module.js'
import { ChecksModule } from './checks/checks.module.js'
import { validationSchema } from './configValidationSchema.js'
import { CountersModule } from './counters/counters.module.js'
import { ExportModule } from './export/export.module.js'
import { FeaturesModule } from './features/features.module.js'
import { FilesModule } from './files/files.module.js'
import { HealthModule } from './health/health.module.js'
import { JBrowseModule } from './jbrowse/jbrowse.module.js'
import { MessagesModule } from './messages/messages.module.js'
import { PluginsModule } from './plugins/plugins.module.js'
import { RefSeqChunksModule } from './refSeqChunks/refSeqChunks.module.js'
import { RefSeqsModule } from './refSeqs/refSeqs.module.js'
import { SequenceModule } from './sequence/sequence.module.js'
import { UsersModule } from './users/users.module.js'
import { CorrelationIdMiddleware } from './utils/correlation-id.middleware.js'
import { JwtAuthGuard } from './utils/jwt-auth.guard.js'
import { AuthorizationGuard } from './utils/validation/authorization.guard.js'

interface MongoDBURIConfig {
  MONGODB_URI?: string
  MONGODB_URI_FILE?: string
}

const nodeEnv = process.env.NODE_ENV ?? 'production'

async function mongoDBURIFactory(
  configService: ConfigService<MongoDBURIConfig, true>,
): Promise<MongooseModuleFactoryOptions> {
  let uri = configService.get('MONGODB_URI', { infer: true })
  if (!uri) {
    // We can use non-null assertion since joi already checks this for us
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const uriFile = configService.get('MONGODB_URI_FILE', { infer: true })!
    const uriFileText = await fs.readFile(uriFile, 'utf8')
    uri = uriFileText.trim()
  }
  return {
    uri,
    connectionFactory: (connection: Connection) => {
      connection.set('maxTimeMS', 7_200_000)
      return connection
    },
  }
}

@Module({
  imports: [
    AssembliesModule,
    AssemblyAccessModule,
    AuthenticationModule,
    ChangesModule,
    ChecksModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
      validationSchema,
    }),
    CountersModule,
    ExportModule,
    FeaturesModule,
    FilesModule,
    HealthModule,
    MessagesModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: mongoDBURIFactory,
      inject: [ConfigService],
    }),
    PluginsModule.registerAsync(),
    RefSeqChunksModule,
    RefSeqsModule,
    SequenceModule,
    UsersModule,
    JBrowseModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    { provide: APP_GUARD, useClass: AssemblyAccessGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Module middleware runs before guards, so JwtAuthGuard/AuthorizationGuard log
    // lines also carry the correlation ID
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
