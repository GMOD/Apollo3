import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Connection, ConnectionOptions, EntityRepository } from 'typeorm'
import { BaseRepository } from 'typeorm-transactional-cls-hooked'

import ApolloUser from '../entity/grails_user.entity'
import UserRole from '../entity/userRole.entity'
import { Database } from '../utils/database'

/**
 * Custom repository for grails_user -table
 */
@EntityRepository(ApolloUser)
export class GrailsUserRepository extends BaseRepository<ApolloUser> {
  private readonly logger = new Logger(GrailsUserRepository.name)

  /**
   * Get all usernames from database - using embedded SQL
   * @returns Return list of usernames with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getAllUsernames(connectionOptions: ConnectionOptions) {
    const database = new Database(connectionOptions)
    // TODO: Put connection name to property file
    const dbConn: Connection = await database.getConnection('testConnection')
    if (dbConn.isConnected) {
      const returnValue = await dbConn.manager.query(
        'SELECT DISTINCT USERNAME FROM GRAILS_USER',
      )
      if (returnValue != null) {
        this.logger.log('Data found (getAllUsernames)')
        this.logger.debug(JSON.stringify(returnValue))
        return returnValue
      }
      this.logger.log('No data found (getAllUsernames)')
      throw new NotFoundException('No data found (getAllUsernames)')
      // return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});
    } else {
      this.logger.error('No connection to database (getAllUsernames)')
      throw new NotFoundException(
        'No connection to database in getUsernamesFromDatabase()',
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});
    }
    // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});
  }

  /**
   * Find user by LastName - using ORM
   * @returns Return user with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async findByLastName(lastname: string) {
    this.logger.log(`Find by lastname : "${lastname}"`)
    const returnValue = await this.findOne({ lastName: lastname })
    if (returnValue != null) {
      this.logger.log('Data found (findByLastName)')
      this.logger.debug(JSON.stringify(returnValue))
      return returnValue
    }
    this.logger.log('No data found (findByLastName)')
    throw new NotFoundException('No data found (findByLastName)')
  }

  /**
   * Get all users and roles from database - using embedded SQL
   * @returns Return list of users and roles with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getUsersAndRolesRepo(connectionOptions: ConnectionOptions) {
    const database = new Database(connectionOptions)
    // TODO: Put connection name to property file
    const dbConn: Connection = await database.getConnection('testConnection')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StringBuilder = require('string-builder')
    const sqlQuery = new StringBuilder('')
    // SQL query to get users and roles
    sqlQuery.appendLine(
      'SELECT DISTINCT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.METADATA, U.METADATA, R.ROLE_ID ',
    )
    sqlQuery.appendLine('FROM GRAILS_USER U, GRAILS_USER_ROLES R ')
    sqlQuery.appendLine('WHERE U.ID = R.USER_ID ')
    if (dbConn.isConnected) {
      const returnValue = await dbConn.manager.query(sqlQuery.toString())
      if (returnValue != null) {
        this.logger.log('Data found (getUsersAndRolesRepo)')
        this.logger.debug(JSON.stringify(returnValue))
        return returnValue
      }
      this.logger.log('No data found (getUsersAndRolesRepo)')
      throw new NotFoundException('No data found (getUsersAndRolesRepo)')
      // return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});
    } else {
      this.logger.error('No connection to database (getUsersAndRolesRepo)')
      throw new InternalServerErrorException(
        'No connection to database in getUsersAndRolesRepo()',
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});
    }
    // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});
  }

  /**
   * Insert new user into database
   * @param newUser - New user information
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  //    async addNewUserRepo(newUser: ApolloUser, response: Response): Promise<Response> {
  //     try {
  //         await ApolloUser.save(newUser);
  //         this.logger.debug('Added new user: ' + JSON.stringify(newUser));

  //         // Get user from database and return it (now it contains userId)
  //         let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });
  //         return response.status(HttpStatus.OK).json(justAddedUser);
  //     } catch(error) {
  //         throw new HttpException('Error in addNewUserRepo() : ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
  //     }
  //   }
  async addNewUserRepo(newUser: ApolloUser) {
    await ApolloUser.save(newUser)
    this.logger.debug(`Added new user: ${JSON.stringify(newUser)}`)
  }

  /**
   * Insert new user's role into database
   * @param newUserRole - New userId and roleId information
   * @returns Return new userRole object with status 'HttpStatus.OK'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async addNewUserRoleRepo(newUserRole: UserRole) {
    await UserRole.save(newUserRole)
    this.logger.debug(`Added new user role: ${JSON.stringify(newUserRole)}`)
  }
}
