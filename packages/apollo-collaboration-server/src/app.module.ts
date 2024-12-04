import fs from 'node:fs/promises'

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose'
import Joi from 'joi'
import { Connection } from 'mongoose'

import { AssembliesModule } from './assemblies/assemblies.module'
import { AuthenticationModule } from './authentication/authentication.module'
import { ChangesModule } from './changes/changes.module'
import { ChecksModule } from './checks/checks.module'
import { CountersModule } from './counters/counters.module'
import { ExportModule } from './export/export.module'
import { FeaturesModule } from './features/features.module'
import { FilesModule } from './files/files.module'
import { HealthModule } from './health/health.module'
import { JBrowseModule } from './jbrowse/jbrowse.module'
import { MessagesModule } from './messages/messages.module'
import { OperationsModule } from './operations/operations.module'
import { PluginsModule } from './plugins/plugins.module'
import { RefSeqChunksModule } from './refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from './refSeqs/refSeqs.module'
import { SequenceModule } from './sequence/sequence.module'
import { UsersModule } from './users/users.module'
import { JwtAuthGuard } from './utils/jwt-auth.guard'
import { ValidationGuard } from './utils/validation/validation.guards'

interface MongoDBURIConfig {
  MONGODB_URI?: string
  MONGODB_URI_FILE?: string
}

const nodeEnv = process.env.NODE_ENV ?? 'production'

const validationSchema = Joi.object({
  // Required
  URL: Joi.string().uri().required(),
  NAME: Joi.string().required(),
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
  // default for this is set in the refSeq mongoose schema
  CHUNK_SIZE: Joi.number(),
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
})
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

@Module({
  imports: [
    AssembliesModule,
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
    OperationsModule,
    PluginsModule.registerAsync(),
    RefSeqChunksModule,
    RefSeqsModule,
    SequenceModule,
    UsersModule,
    JBrowseModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ValidationGuard },
  ],
})
export class AppModule {}
