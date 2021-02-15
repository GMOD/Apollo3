import PluginManager from '@jbrowse/core/PluginManager'
import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'

export default (pluginManager: PluginManager) => {
  return {
    configSchema: pluginManager.jbrequire(configSchemaFactory),
    stateModel: pluginManager.jbrequire(stateModelFactory),
  }
}
