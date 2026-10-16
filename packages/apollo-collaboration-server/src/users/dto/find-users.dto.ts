export class FindUsersDto {
  readonly page?: string
  readonly pageSize?: string
  readonly sortField?: string
  readonly sortOrder?: string
  readonly search?: string
  /** Comma-separated list of roles */
  readonly role?: string
  /** Whether to include (default) or exclude users with the given roles */
  readonly roleOperator?: 'in' | 'notIn'
}
