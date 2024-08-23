/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Change, ChangeOptions, SerializedChange, isChange } from './Change'

export interface SerializedAssemblySpecificChange extends SerializedChange {
  assembly: string
}

export function isAssemblySpecificChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thing: any,
): thing is AssemblySpecificChange {
  return (
    isChange(thing) && (thing as AssemblySpecificChange).assembly !== undefined
  )
}

export abstract class AssemblySpecificChange extends Change {
  assembly: string

  constructor(json: SerializedAssemblySpecificChange, options?: ChangeOptions) {
    super(json, options)
    this.assembly = json.assembly
  }
}
