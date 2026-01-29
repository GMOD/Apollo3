import { type Check } from './Check.js'

class CheckRegistry {
  checks = new Map<string, Check>()

  registerCheck(name: string, check: Check): void {
    if (this.checks.has(name)) {
      throw new Error(`check "${name}" has already been registered`)
    }
    this.checks.set(name, check)
  }

  getCheck(name: string): Check {
    const registeredCheck = this.checks.get(name)
    if (!registeredCheck) {
      throw new Error(`No check constructor registered for "${name}"`)
    }
    return registeredCheck
  }

  getChecks() {
    return this.checks
  }
}

/** global singleton of all known checks */
export const checkRegistry = new CheckRegistry()
