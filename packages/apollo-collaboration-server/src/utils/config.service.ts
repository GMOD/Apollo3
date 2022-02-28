class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  private getValue(key: string): string | undefined
  private getValue<T extends boolean>(
    key: string,
    throwOnMissing: T,
  ): T extends true ? string : string | undefined
  private getValue(key: string, throwOnMissing?: boolean) {
    const value = this.env[key]
    if (throwOnMissing) {
      if (!value) {
        throw new Error(`config error - missing env.${key}`)
      }
      return value
    }
    return value
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true))
    return this
  }

  public getPort() {
    return this.getValue('PORT', true)
  }

  public isProduction() {
    const mode = this.getValue('MODE', false)
    return mode !== 'DEV'
  }
}
