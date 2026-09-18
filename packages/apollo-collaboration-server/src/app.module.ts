import fs from 'node:fs/promises'

import { Module } from '@nestjs/common'
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
import Joi from 'joi'
import type { Connection } from 'mongoose'

import { AssembliesModule } from './assemblies/assemblies.module.js'
import { AuthenticationModule } from './authentication/authentication.module.js'
import { ChangesModule } from './changes/changes.module.js'
import { ChecksModule } from './checks/checks.module.js'
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
import { resolveJBrowseDir } from './utils/jbrowse-dir.util.js'
import { JwtAuthGuard } from './utils/jwt-auth.guard.js'
import { ValidationGuard } from './utils/validation/validation.guards.js'

interface MongoDBURIConfig {
  MONGODB_URI?: string
  MONGODB_URI_FILE?: string
}

interface JBrowseDirConfig {
  JBROWSE_DIR?: string
  JBROWSE_DEV_SERVER_URL?: string
}

const nodeEnv = process.env.NODE_ENV ?? 'production'
const envFilesByNodeEnv: Record<string, string> = {
  development: '.development.env',
  cypress: '.cypress.env',
}

export const validationSchema = Joi.object({
  // Required
  URL: Joi.string().uri().required(),
  NAME: Joi.string().required(),
  // Exactly one of these two is required (see the `.xor` below): JBROWSE_DIR
  // for serving a built JBrowse Web + Apollo plugin bundle from disk,
  // JBROWSE_DEV_SERVER_URL for proxying to a running JBrowse dev server
  // instead (dev-only; see IndexHtmlController and the fallback proxy
  // middleware in main.ts).
  JBROWSE_DIR: Joi.string(),
  JBROWSE_DEV_SERVER_URL: Joi.string().uri(),
  MONGODB_URI: Joi.string(),
  MONGODB_URI_FILE: Joi.string(),
  FILE_UPLOAD_FOLDER: Joi.string().required(),
  GOOGLE_CLIENT_ID: Joi.string(),
  GOOGLE_CLIENT_ID_FILE: Joi.string(),
  GOOGLE_CLIENT_SECRET: Joi.string(),
  GOOGLE_CLIENT_SECRET_FILE: Joi.string(),
  MICROSOFT_CLIENT_ID: Joi.string(),
  MICROSOFT_CLIENT_ID_FILE: Joi.string(),
  MICROSOFT_CLIENT_SECRET: Joi.string(),
  MICROSOFT_CLIENT_SECRET_FILE: Joi.string(),
  JWT_SECRET: Joi.string(),
  JWT_SECRET_FILE: Joi.string(),
  SESSION_SECRET: Joi.string(),
  SESSION_SECRET_FILE: Joi.string(),
  // Optional
  DESCRIPTION: Joi.string(),
  FEATURE_TYPE_ONTOLOGY_LOCATION: Joi.string(),
  PLUGIN_LOCATION: Joi.string(),
  // Comma-separated list of config.json filenames this server serves
  // (resolved the same way as config.json: off JBROWSE_DIR on disk, or
  // fetched from JBROWSE_DEV_SERVER_URL). Each listed file is served, at its
  // own literal path, as the Apollo-augmented config (see
  // ConfigFileController) - e.g. "config.json,config_mouse.json" makes both
  // "/config.json" and "/config_mouse.json" augmented, with no extra query
  // param needed. Independent of the JBROWSE_DIR/JBROWSE_DEV_SERVER_URL
  // `.xor` above - no xor needed here. Defaults to a single "config.json"
  // when unset (see JBrowseConfigService.getConfigFileNames).
  JBROWSE_CONFIG_FILES: Joi.string(),
  SKIPPED_ATTRIBUTES_ON_COPY: Joi.string().default(''),
  INDEXED_IDS: Joi.string().default('gff_id'),
  ALLOW_ROOT_USER: Joi.boolean().default(false),
  ROOT_USER_PASSWORD: Joi.string(),
  ROOT_USER_PASSWORD_FILE: Joi.string(),

  PORT: Joi.number().default(3999),
  CORS: Joi.boolean().default(true),
  LOG_LEVELS: Joi.string()
    .custom((value) => {
      const errorMessage =
        'LOG_LEVELS must be a comma-separated list of log levels to output, where the possible values are: error, warn, log, debug, verbose'
      if (typeof value !== 'string') {
        throw new TypeError(errorMessage)
      }
      const levels = value.split(',')
      for (const level of levels) {
        if (!['log', 'error', 'warn', 'debug', 'verbose'].includes(level)) {
          throw new Error(errorMessage)
        }
      }
      return value
    })
    .default('log,warn,error'),
  DEFAULT_NEW_USER_ROLE: Joi.string()
    .valid('admin', 'user', 'readOnly', 'none')
    .default('none'),
  BROADCAST_USER_LOCATION: Joi.boolean().default(true),
  ALLOW_GUEST_USER: Joi.boolean().default(false),
  GUEST_USER_ROLE: Joi.string()
    .valid('admin', 'user', 'readOnly')
    .default('readOnly'),
  PLUGIN_URLS: Joi.string()
    .custom((value) => {
      const errorMessage =
        'PLUGIN_URLS must be a comma-separated list of plugin URLs'
      if (typeof value !== 'string') {
        throw new TypeError(errorMessage)
      }
      const urls = value.split(',')
      for (const url of urls) {
        try {
          new URL(url)
        } catch {
          throw new Error(errorMessage)
        }
      }
      return value
    })
    .default(''),
  PLUGIN_URLS_FILE: Joi.string(),
  OAUTH_HTTP_PROXY: Joi.string(),
})
  .xor('JBROWSE_DIR', 'JBROWSE_DEV_SERVER_URL')
  .xor('MONGODB_URI', 'MONGODB_URI_FILE')
  .oxor('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID_FILE')
  .oxor('GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET_FILE')
  .oxor('MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_ID_FILE')
  .oxor('MICROSOFT_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET_FILE')
  .xor('JWT_SECRET', 'JWT_SECRET_FILE')
  .xor('SESSION_SECRET', 'SESSION_SECRET_FILE')
  .xor('PLUGIN_URLS', 'PLUGIN_URLS_FILE')

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
    { provide: APP_GUARD, useClass: ValidationGuard },
  ],
})
export class AppModule {}
