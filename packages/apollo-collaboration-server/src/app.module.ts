import fs from 'node:fs/promises'

import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common'
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import {
  MongooseModule,
  type MongooseModuleFactoryOptions,
} from '@nestjs/mongoose'
import {
  ServeStaticModule,
  type ServeStaticModuleOptions,
} from '@nestjs/serve-static'
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
import { ConfigFileModule } from './jbrowse/config-file.module.js'
import { DevServerProxyModule } from './jbrowse/dev-server-proxy.module.js'
import { JBrowseModule } from './jbrowse/jbrowse.module.js'
import { MessagesModule } from './messages/messages.module.js'
import { PluginsModule } from './plugins/plugins.module.js'
import { RefSeqsModule } from './refSeqs/refSeqs.module.js'
import { SequenceModule } from './sequence/sequence.module.js'
import { UsersModule } from './users/users.module.js'
import { CorrelationIdMiddleware } from './utils/correlation-id.middleware.js'
import { getEmbeddedMongoDBURI } from './utils/embeddedMongoDB.js'
import { resolveJBrowseDir } from './utils/jbrowse-dir.util.js'
import { JwtAuthGuard } from './utils/jwt-auth.guard.js'
import { AuthorizationGuard } from './utils/validation/authorization.guard.js'

interface MongoDBURIConfig {
  MONGODB_URI?: string
  MONGODB_URI_FILE?: string
  MONGODB_EMBEDDED_DIR?: string
}

interface JBrowseDirConfig {
  JBROWSE_DIR?: string
  JBROWSE_DEV_SERVER_URL?: string
}

const nodeEnv = process.env.NODE_ENV ?? 'production'
const envFilesByNodeEnv: Record<string, string | string[]> = {
  development: ['.development.local.env', '.development.env'],
  embedded: ['.development.local.env', '.embedded.env'],
  cypress: '.cypress.env',
  test: '.test.env',
}

async function mongoDBURIFactory(
  configService: ConfigService<MongoDBURIConfig, true>,
): Promise<MongooseModuleFactoryOptions> {
  let uri = configService.get('MONGODB_URI', { infer: true })
  if (!uri) {
    const uriFile = configService.get('MONGODB_URI_FILE', { infer: true })
    if (uriFile) {
      const uriFileText = await fs.readFile(uriFile, 'utf8')
      uri = uriFileText.trim()
    } else {
      // We can use non-null assertion since joi already checks this for us
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const embeddedDir = configService.get('MONGODB_EMBEDDED_DIR', {
        infer: true,
      })!
      uri = await getEmbeddedMongoDBURI(embeddedDir)
    }
  }
  return {
    uri,
    connectionFactory: (connection: Connection) => {
      connection.set('maxTimeMS', 7_200_000)
      return connection
    },
  }
}

export function serveStaticFactory(
  configService: ConfigService<JBrowseDirConfig, true>,
): ServeStaticModuleOptions[] {
  const jbrowseDir = configService.get('JBROWSE_DIR', { infer: true })
  if (!jbrowseDir) {
    // JBROWSE_DEV_SERVER_URL is configured instead (mutually exclusive with
    // JBROWSE_DIR, enforced by the Joi schema's `.xor`): there is nothing on
    // disk to serve. Everything other than Apollo's own routes is handled
    // by DevServerProxyController instead.
    return []
  }
  return [
    {
      rootPath: resolveJBrowseDir(jbrowseDir),
      serveRoot: '/',
      // "/" and "/index.html" are served by IndexHtmlController instead,
      // which reads index.html from this same directory and augments it
      // with the 401 -> /login redirect script. Every configured
      // config.json (ConfigFileController) is served dynamically too, but
      // that's not what makes this exclude list matter: Nest registers
      // every controller route on the Express app during bootstrap, before
      // @nestjs/serve-static registers this static-file middleware (in its
      // own onModuleInit), so a controller route always wins regardless of
      // this list - it's here for documentation/defense in depth only.
      exclude: ['/', '/index.html'],
      serveStaticOptions: { fallthrough: false },
    },
  ]
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
      envFilePath: envFilesByNodeEnv[nodeEnv] ?? '.env',
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
    RefSeqsModule,
    SequenceModule,
    UsersModule,
    JBrowseModule,
    // Must come after every module that owns an Apollo API route and before
    // ServeStaticModule/DevServerProxyModule: its catch-all GET claims the
    // configured config.json paths and hands everything else back to
    // Express with next(). See ConfigFileController for why it has to be a
    // wildcard route rather than one route per configured file.
    ConfigFileModule,
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: serveStaticFactory,
    }),
    // Registered last so its catch-all route only ever sees requests none
    // of the modules above claimed. Only actually registers
    // DevServerProxyModule's routes when JBROWSE_DEV_SERVER_URL is set;
    // see DevServerProxyController for why this can't just check the
    // config itself and no-op instead.
    ConditionalModule.registerWhen(
      DevServerProxyModule,
      (env) => Boolean(env.JBROWSE_DEV_SERVER_URL),
      { debug: false },
    ),
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
