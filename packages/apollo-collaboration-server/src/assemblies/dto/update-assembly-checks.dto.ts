export class UpdateAssemblyChecksDto {
  /** Assembly ID */
  _id: string
  /** IDs of the checks to run on this assembly */
  checks: string[]
}
