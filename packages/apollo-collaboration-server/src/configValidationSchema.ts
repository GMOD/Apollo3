import Joi from 'joi'

import {
  parseCommaSeparatedList,
  parsePluginIntegrity,
} from './plugins/pluginConfig.js'

/** Validation schema for the server's environment variables */
export const validationSchema = Joi.object({
  // Required
  URL: Joi.string().uri().required(),
  NAME: Joi.string().required(),
  // Exactly one of these two is required (see the `.xor` below): JBROWSE_DIR
  // for serving a built JBrowse Web + Apollo plugin bundle from disk,
  // JBROWSE_DEV_SERVER_URL for proxying to a running JBrowse dev server
  // instead (dev-only; see IndexHtmlController and DevServerProxyController).
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
  MICROSOFT_TENANT: Joi.string(),
  OIDC_PROVIDERS: Joi.string(),
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
  // param needed. Defaults to a single "config.json" when unset (see
  // JBrowseConfigService.getConfigFileNames).
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
  INITIAL_ADMIN_EMAIL: Joi.string().email(),
  ONLY_ALLOW_APPROVED_USERS: Joi.boolean().default(false),
  PLUGIN_URLS: Joi.string().custom((value: string) => {
    for (const url of parseCommaSeparatedList(value)) {
      try {
        new URL(url)
      } catch {
        throw new Error(
          'PLUGIN_URLS must be a comma-separated list of plugin URLs',
        )
      }
    }
    return value
  }),
  PLUGIN_URLS_FILE: Joi.string(),
  // Comma-separated list of npm package specifiers to load as server plugins,
  // in addition to (not instead of) PLUGIN_URLS/PLUGIN_URLS_FILE
  PLUGIN_PACKAGES: Joi.string(),
  // Comma-separated list of url=sha256 pairs for PLUGIN_URLS entries
  PLUGIN_INTEGRITY: Joi.string().custom((value: string) => {
    parsePluginIntegrity(value)
    return value
  }),
  PLUGIN_CACHE_DIR: Joi.string(),
  OAUTH_HTTP_PROXY: Joi.string(),
  ALLOWED_REDIRECT_ORIGINS: Joi.string()
    .custom((value) => {
      if (typeof value !== 'string') {
        throw new TypeError('ALLOWED_REDIRECT_ORIGINS must be a string')
      }
      for (const origin of value.split(',')) {
        try {
          new URL(origin.trim())
        } catch {
          throw new Error(
            'ALLOWED_REDIRECT_ORIGINS must be a comma-separated list of origins, e.g. https://jbrowse.example.org',
          )
        }
      }
      return value
    })
    .allow(''),
  // Size in bytes of the capped collection that carries server-sent events
  // between server processes
  EVENTS_COLLECTION_SIZE: Joi.number()
    .integer()
    .positive()
    .default(64 * 1024 * 1024),
})
  .xor('JBROWSE_DIR', 'JBROWSE_DEV_SERVER_URL')
  .xor('MONGODB_URI', 'MONGODB_URI_FILE')
  .oxor('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID_FILE')
  .oxor('GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET_FILE')
  .oxor('MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_ID_FILE')
  .oxor('MICROSOFT_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET_FILE')
  .xor('JWT_SECRET', 'JWT_SECRET_FILE')
  .xor('SESSION_SECRET', 'SESSION_SECRET_FILE')
  .oxor('PLUGIN_URLS', 'PLUGIN_URLS_FILE')
  .oxor('ROOT_USER_PASSWORD', 'ROOT_USER_PASSWORD_FILE')
  // A root user password is required if ALLOW_ROOT_USER is true
  .when(
    Joi.object({ ALLOW_ROOT_USER: Joi.boolean().invalid(true) }).unknown(),
    {
      otherwise: Joi.object().or(
        'ROOT_USER_PASSWORD',
        'ROOT_USER_PASSWORD_FILE',
      ),
    },
  )
