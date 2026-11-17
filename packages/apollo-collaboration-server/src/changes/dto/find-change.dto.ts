export class FindChangeDto {
  /** Only changes to this assembly */
  readonly assembly?: string
  /** Only changes to these feature IDs */
  readonly changedIds?: string[]
  /** Only changes that revert this change ID */
  readonly reverts?: string
  /** Only changes by users whose email matches this (case-insensitive regular expression) */
  readonly user?: string
  /** Only changes of this type, e.g. `AddFeatureChange` */
  readonly typeName?: string
  /** Only changes with a sequence number greater than this */
  readonly since?: string
  /** Deprecated, use `sortOrder`. `1` sorts in ascending order. */
  readonly sort?: string
  /** Maximum number of changes to return, if not using `page` and `pageSize` */
  readonly limit?: string
  /** Page to return, starting from 0. Requires `pageSize`. */
  readonly page?: string
  /** Number of changes in a page. Requires `page`. */
  readonly pageSize?: string
  /** Field to sort by: `sequence` (default), `typeName`, `user`, or `createdAt` */
  readonly sortField?: string
  /** `asc` or `desc` (default) */
  readonly sortOrder?: string
  /** Only changes made at or after this time (ISO 8601) */
  readonly startTime?: string
  /** Only changes made at or before this time (ISO 8601) */
  readonly endTime?: string
}
