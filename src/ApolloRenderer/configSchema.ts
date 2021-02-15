import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { svgFeatureRendererConfigSchema } from '@jbrowse/plugin-svg'

const configSchema = ConfigurationSchema(
  'ApolloRenderer',
  {},
  { baseConfiguration: svgFeatureRendererConfigSchema, explicitlyTyped: true },
)

export { configSchema }
