/**
 * A serialized change. Which other properties are needed depends on
 * `typeName`.
 */
export class SubmitChangeDto {
  /** The type of change */
  readonly typeName: string
  /** Assembly ID, for changes to an assembly or its features */
  readonly assembly?: string
  /** IDs of the features this change modifies, for feature changes */
  readonly changedIds?: string[]
}
