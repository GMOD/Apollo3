import { HttpException, HttpStatus, Logger } from '@nestjs/common'
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
    try {
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
        throw new HttpException(
          'No data found (getAllUsernames)',
          HttpStatus.NOT_FOUND,
        )
        // return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});
      } else {
        this.logger.error('No connection to database (getAllUsernames)')
        throw new HttpException(
          'No connection to database in getUsernamesFromDatabase()',
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
        // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});
      }
    } catch (error) {
      this.logger.error(`Error in getUsernamesFromDatabase(): ${error}`)
      throw new HttpException(
        `Error in getUsernamesFromDatabase(): ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});
    }
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
    throw new HttpException(
      'No data found (findByLastName)',
      HttpStatus.NOT_FOUND,
    )
  }

  /**
   * Get all users and roles from database - using embedded SQL
   * @returns Return list of users and roles with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getUsersAndRolesRepo(connectionOptions: ConnectionOptions) {
    const database = new Database(connectionOptions)
    try {
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
        throw new HttpException(
          'No data found (getUsersAndRolesRepo)',
          HttpStatus.NOT_FOUND,
        )
        // return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});
      } else {
        this.logger.error('No connection to database (getUsersAndRolesRepo)')
        throw new HttpException(
          'No connection to database in getUsersAndRolesRepo()',
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
        // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});
      }
    } catch (error) {
      this.logger.error(`Error in getUsersAndRolesRepo(): ${error}`)
      throw new HttpException(
        `Error in getUsersAndRolesRepo(): ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});
    }
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
  async addNewUserRepo(newUser: ApolloUser): Promise<void> {
    try {
      await ApolloUser.save(newUser)
      this.logger.debug(`Added new user: ${JSON.stringify(newUser)}`)
    } catch (error) {
      throw new HttpException(
        `Error in addNewUserRepo() : ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * Insert new user's role into database
   * @param newUserRole - New userId and roleId information
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
