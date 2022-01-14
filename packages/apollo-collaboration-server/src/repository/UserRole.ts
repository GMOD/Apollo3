import { HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'
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
   * @param response -
   * @returns Return new userRole object with status 'HttpStatus.OK'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async addNewUserRoleRepo(newUserRole: UserRole): Promise<void> {
    try {
      await UserRole.save(newUserRole)
      this.logger.debug(`Added new user role: ${JSON.stringify(newUserRole)}`)
    } catch (error) {
      throw new HttpException(
        `Error in addNewUserRoleRepo() : ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
