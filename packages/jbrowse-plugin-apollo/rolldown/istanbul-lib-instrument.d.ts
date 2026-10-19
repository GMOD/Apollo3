// istanbul-lib-instrument doesn't ship types, and @types/istanbul-lib-instrument
// is for an old major version, so this declares just the parts we use
declare module 'istanbul-lib-instrument' {
  import type { ExistingRawSourceMap } from 'rolldown'

  interface InstrumenterOptions {
    esModules?: boolean
    produceSourceMap?: boolean
    parserPlugins?: string[]
  }

  interface Instrumenter {
    instrumentSync(
      code: string,
      filename: string,
      inputSourceMap?: object | null,
    ): string
    lastSourceMap(): ExistingRawSourceMap | null
  }

  export function createInstrumenter(opts?: InstrumenterOptions): Instrumenter
  export const defaultOpts: Required<Pick<InstrumenterOptions, 'parserPlugins'>>
}
