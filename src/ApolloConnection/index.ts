import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'
import configSchema from './configSchema'
import { getAssemblies } from './getAssemblies'

export default (jbrowse: PluginManager) => {
  const stateModel = jbrowse.jbrequire(modelFactory)

  return { configSchema, stateModel, getAssemblies }
}
