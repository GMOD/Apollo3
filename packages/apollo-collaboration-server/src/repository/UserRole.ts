import { Logger } from '@nestjs/common'
import { EntityRepository } from 'typeorm'
import { BaseRepository } from 'typeorm-transactional-cls-hooked'

import UserRole from '../entity/userRole.entity'

/**
 * Custom repository for grails_user -table
 */
@EntityRepository(UserRole)
export class UserRoleRepository extends BaseRepository<UserRole> {
  private readonly logger = new Logger(UserRoleRepository.name)

  /**
   * Insert new user's role into database
   * @param newUserRole - New userId and roleId information
   * @returns Return new userRole object with status 'HttpStatus.OK'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async addNewUserRoleRepo(newUserRole: UserRole): Promise<void> {
    await UserRole.save(newUserRole)
    this.logger.debug(`Added new user role: ${JSON.stringify(newUserRole)}`)
  }
}
