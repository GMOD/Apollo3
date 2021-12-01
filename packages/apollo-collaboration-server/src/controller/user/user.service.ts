import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Response } from 'express'
import { Repository, getConnectionManager, getCustomRepository } from 'typeorm'

import ApolloUser from '../../entity/grails_user.entity'
import UserRole from '../../entity/userRole.entity'
import { GrailsUserRepository } from '../../repository/GrailsUserRepository'
import { UserRoleRepository } from '../../repository/UserRole'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)
  private readonly mysql = require('mysql2/promise')

  constructor(
    @InjectRepository(ApolloUser)
    private grailsUsersRepository: Repository<ApolloUser>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    readonly repository: GrailsUserRepository,
    private configService: ConfigService,
  ) {}

  /**
   * Get all users and their roles using ORM
   * @param response
   * @returns Return list of users and their roles with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getUsersAndRoles(response: Response): Promise<Response> {
    try {
      // Find all users
      const returnValue = await ApolloUser.find()

      // Loop all users and add roles
      for (const result of returnValue) {
        // Get user roles and add it to JSON
        const a = await UserRole.find({ userId: result.id })
        result.userRoles = a
      }

      if (returnValue != null) {
        this.logger.log('Data found (getUsersAndRoles)')
        this.logger.debug(JSON.stringify(returnValue))
        return response.status(HttpStatus.OK).json(returnValue)
      }
      this.logger.warn('No data found (getUsersAndRoles)')
      return response
        .status(HttpStatus.NOT_FOUND)
        .json({ status: HttpStatus.NOT_FOUND, message: 'No data found' })
    } catch (error) {
      throw new HttpException(
        `Error in getUsersAndRoles() : ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsersAndRoles() : ' + error});
    }
  }

  /**
   * Get all users using ORM
   * @param response
   * @returns Return list of users with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getAllUsersORM(response: Response): Promise<Response> {
    try {
      const returnValue = await ApolloUser.find()
      if (returnValue != null) {
        this.logger.log('Data found (getAllUsersORM)')
        this.logger.debug(JSON.stringify(returnValue))
        return response.status(HttpStatus.OK).json(returnValue)
      }
      this.logger.warn('No data found (getAllUsersORM)')
      return response
        .status(HttpStatus.NOT_FOUND)
        .json({ status: HttpStatus.NOT_FOUND, message: 'No data found' })
    } catch (error) {
      throw new HttpException(
        `Error in getAllUsersORM() : ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getAllUsersORM() : ' + error});
    }
  }

  /**
   * Check if new user does not exist in database and if not then add it. This method is using TypeORM transaction
   * @param newUser New user information
   * @param response
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of user already exists then return error message with 'HttpStatus.CONFLICT'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  // @Transactional()
  // If we use @Transactional() -decorator so then db changes are visible only after whole method is finished
  // i.e. after inserting new record, 'await ApolloUser.findOne({ userName: newUser.userName });' -function  does not return anything
  async addNewUserTypeORMTransaction(
    newUser: ApolloUser,
    response: Response,
  ): Promise<Response> {
    // let newUser2 = JSON.parse(JSON.stringify(newUser)); // Copy incoming object for test purpose only

    try {
      // Check if there is already same username in db
      const foundUser = await ApolloUser.findOne({ userName: newUser.userName })
      if (foundUser != null) {
        const msg = `Username ${newUser.userName} already exists!`
        this.logger.error(msg)
        return response
          .status(HttpStatus.CONFLICT)
          .json({ status: HttpStatus.CONFLICT, message: msg })
      }

      // Get connection
      const conMan = getConnectionManager()
      const con = conMan.get()

      // Transaction rollback is not working if we call our own methods in customs repository!!!!
      await con.transaction(async (transaction) => {
        // If you are using Customs repository method addNewUserRepo() then transaction rollback is not working
        // await transaction.getCustomRepository(GrailsUserRepository).addNewUserRepo(newUser);
        await transaction
          .getCustomRepository(GrailsUserRepository)
          .save(newUser)
        this.logger.debug(`Added new user with id=${newUser.id}`)

        // TODO: Role information is now hard-coded
        const userRole = new UserRole()
        userRole.userId = newUser.id
        userRole.roleId = 3 // TODO: HARDCODE VALUE FOR DEMO ONLY
        // If you are using Customs repository method addNewUserRoleRepo() then transaction rollback is not working
        // await transaction.getCustomRepository(UserRoleRepository).addNewUserRoleRepo(userRole);
        await transaction.getCustomRepository(UserRoleRepository).save(userRole)
        this.logger.debug(
          `Added role ${userRole.roleId} for new user (id=${newUser.id})`,
        )
      })
      this.logger.debug('Commit done!')

      // Get user from database and return it (now it contains userId). Actually we could also directly use 'newUser' -object because it has id after it was inserted into db
      const justAddedUser = await ApolloUser.findOne({
        userName: newUser.userName,
      })
      return response
        .status(HttpStatus.OK)
        .json({ status: HttpStatus.OK, message: justAddedUser })
    } catch (errMsg) {
      throw new HttpException(
        `ERROR in addNewUserTypeORMTransaction(catch) : ${errMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * Check if new user does not exist in database and if not then add it. This is using TypeScript/MySQL transaction
   * @param newUser New user information
   * @param response
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of user already exists then return error message with 'HttpStatus.CONFLICT'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async addNewUser(newUser: ApolloUser, response: Response): Promise<Response> {
    let dbConn

    try {
      // Check if there is already same username in db
      const foundUser = await ApolloUser.findOne({ userName: newUser.userName })
      if (foundUser != null) {
        const msg = `Username ${newUser.userName} already exists!`
        this.logger.error(msg)
        return response
          .status(HttpStatus.CONFLICT)
          .json({ status: HttpStatus.CONFLICT, message: msg })
      }

      // Create connection
      const pool = this.mysql.createPool({
        host: this.configService.get<string>('TYPEORM_HOST'),
        user: this.configService.get<string>('TYPEORM_USERNAME'),
        password: this.configService.get<string>('TYPEORM_PASSWORD'),
        database: this.configService.get<string>('TYPEORM_DATABASE'),
      })
      this.logger.verbose('Creating connection...')
      dbConn = await pool.getConnection()
      this.logger.verbose('Starting transaction...')
      await dbConn.beginTransaction()

      // Add new user
      const addUserSql =
        'INSERT INTO grails_user (version, inactive, first_name, last_name, username, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
      const addUserArgs = [
        newUser.version,
        newUser.inactive,
        newUser.firstName,
        newUser.lastName,
        newUser.userName,
        newUser.passwordHash,
      ]
      const queryResultAddUser = await dbConn.query(addUserSql, addUserArgs)
      const newUserId = queryResultAddUser[0].insertId
      this.logger.debug(`Added new user with id = ${newUserId}`)

      // Add user role
      // TODO: Role information is now hard-coded
      const userRole = new UserRole()
      userRole.userId = newUserId
      userRole.roleId = 3 // TODO: HARDCODE VALUE FOR DEMO ONLY
      const addRoleSql =
        'INSERT INTO grails_user_roles (user_id, role_id) VALUES (?, ?)'
      const addRoleArgs = [userRole.userId, userRole.roleId]
      await dbConn.query(addRoleSql, addRoleArgs)
      this.logger.debug(`Added role ${userRole.roleId} for new user`)

      await dbConn.commit()
      this.logger.verbose('Committed')
      dbConn.release()
      // Get user from database and return it (now it contains userId)
      const justAddedUser = await ApolloUser.findOne({
        userName: newUser.userName,
      })
      return response
        .status(HttpStatus.OK)
        .json({ status: HttpStatus.OK, message: justAddedUser })
    } catch (err) {
      this.logger.error(`ERROR when creating new user: ${err}`)
      dbConn.rollback()
      dbConn.release()
      this.logger.debug('Rollback done')
      throw new HttpException(
        `ERROR in addNewUser() : ${err}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async getAllUsernames(response: Response) {
    return getCustomRepository(GrailsUserRepository).getAllUsernames(response, {
      type: this.configService.get<'mysql'>('TYPEORM_CONNECTION'),
      name: 'testConnection',
      host: this.configService.get<string>('TYPEORM_HOST'),
      port: parseInt(this.configService.get<string>('TYPEORM_PORT'), 10),
      username: this.configService.get<string>('TYPEORM_USERNAME'),
      password: this.configService.get<string>('TYPEORM_PASSWORD'),
      database: this.configService.get<string>('TYPEORM_DATABASE'),
      entities: ['../entity/**/*.ts'], // entities: [ApolloUser, UserRole],
      synchronize: JSON.parse(
        this.configService.get<string>('TYPEORM_SYNCHRONIZE'),
      ),
    })
  }
}
