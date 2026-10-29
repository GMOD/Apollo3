import { checkRegistry } from '@apollo-annotation/common'
import type PluginManager from '@jbrowse/core/PluginManager'

import { clientChangeTypes } from './session/clientChangeTypes'
import { clientValidations } from './validation/ClientValidationSet'

/**
 * Collect the change types, checks and validations other plugins contribute
 * through Apollo's client extension points, and register them. Called from
 * `ApolloPlugin.configure()`, which runs after every plugin's `install()`.
 *
 * Plugins are configured again whenever JBrowse creates a new plugin manager
 * (e.g. on a config reload), so registering the same class under the same
 * name again replaces the earlier registration instead of failing.
 */
export function registerPluginContributions(pluginManager: PluginManager) {
  const changeTypes = pluginManager.evaluateExtensionPoint(
    'Apollo-RegisterChangeTypes',
    {},
  )
  for (const [name, changeType] of Object.entries(changeTypes)) {
    clientChangeTypes.register(name, changeType)
  }

  const checks = pluginManager.evaluateExtensionPoint(
    'Apollo-RegisterChecks',
    [],
  )
  for (const check of checks) {
    const existing = checkRegistry.checks.get(check.name)
    if (existing && existing.constructor !== check.constructor) {
      throw new Error(`check "${check.name}" has already been registered`)
    }
    checkRegistry.checks.set(check.name, check)
  }

  const validations = pluginManager.evaluateExtensionPoint(
    'Apollo-RegisterValidations',
    [],
  )
  for (const validation of validations) {
    clientValidations.register(validation)
  }
}
