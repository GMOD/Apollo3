import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Connection, EntityManager, Repository, TransactionManager } from 'typeorm';
import { Response } from 'express';
import ApolloUser from '../../entity/grails_user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from '../../utils/database';
import UserRole from '../../entity/userRole.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly mysql = require('mysql2/promise');
  private readonly mySqlConfig = require('../../utils/dbConfig');

  constructor(
      @InjectRepository( ApolloUser )
      private grailsUsersRepository: Repository<ApolloUser>,
      @InjectRepository( UserRole )
      private userRoleRepo: Repository<UserRole>,
  ) {};
    
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
      let returnValue = await ApolloUser.find();

      // Loop all users and add roles
      for(let result of returnValue){
        // Get user roles and add it to JSON
        let a = await UserRole.find({ userId:result.id });
        result['userRoles'] = a;
     }

      if (returnValue != null) {
        this.logger.log('Data found (getUsersAndRoles)');
        this.logger.debug(JSON.stringify(returnValue));
        return response.status(HttpStatus.OK).json(returnValue);
      } else {
        this.logger.warn('No data found (getUsersAndRoles)');
        return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
      }
    } catch(error) {
        throw new HttpException('Error in getUsersAndRoles() : ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
        //return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsersAndRoles() : ' + error});
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
      let returnValue = await ApolloUser.find();
      if (returnValue != null) {
        this.logger.log('Data found (getAllUsersORM)');
        this.logger.debug(JSON.stringify(returnValue));
        return response.status(HttpStatus.OK).json(returnValue);
      } else {
        this.logger.warn('No data found (getAllUsersORM)');
        return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
      }
    } catch(error) {
        throw new HttpException('Error in getAllUsersORM() : ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
        //return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getAllUsersORM() : ' + error});
    }        
  }

  /**
   * Check if new user does not exist in database and if not then add it
   * @param newUser New user information
   * @param response 
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of user already exists then return error message with 'HttpStatus.CONFLICT'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
    async addNewUserTestOnly(newUser: ApolloUser, @TransactionManager() manager: EntityManager, response: Response): Promise<Response> {
      try {
          let foundUser = await ApolloUser.findOne({ userName: newUser.userName });
          if (foundUser != null) {
            let msg: string = 'Username ' + newUser.userName + ' already exists!'
            this.logger.error(msg);
            return response.status(HttpStatus.CONFLICT).json({status: HttpStatus.CONFLICT, message: msg});
          } 
  
        //   // The user did not exist yet, so let's insert it and user's role
          const database = new Database();
          const dbConn: Connection = await database.getConnection('testConnection');
          const queryRunner = dbConn.createQueryRunner();
        //   const manager = new EntityManager(dbConn);

        //   // TODO: Role information is now hard-coded
        //   let userRole = new UserRole();
        //   userRole.userId = 49; // justAddedUser.id;
        //   userRole.roleId = 3; // TODO: HARDCODE VALUE FOR DEMO ONLY
          
        //   // const connection = getConnection('default');
        //   newUser.version=1;
        //   console.log('Nimi=' + newUser.firstName);
        //   await dbConn.transaction(async manager => {
        //     // in transactions you MUST use manager instance provided by a transaction,
        //     // you cannot use global managers, repositories or custom repositories
        //     // because this manager is exclusive and transactional
        //     // and if let's say we would do custom repository as a service
        //     // it has a "manager" property which should be unique instance of EntityManager
        //     // but there is no global EntityManager instance and cannot be
        //     // thats why custom managers are specific to each EntityManager and cannot be services.
        //     // this also opens opportunity to use custom repositories in transactions without any issues:
            
        //     const userRepository = manager.getCustomRepository(GrailsUserRepository); // DONT USE GLOBAL getCustomRepository here!
        //     await userRepository.addNewUserRepo(newUser);
        //     await userRepository.addNewUserRepo(newUser);
        //     //const timber = await userRepository.findByName("Timber", "Saw");
        // });
          // lets now open a new transaction:
          await queryRunner.startTransaction();
          try {
              // execute some operations on this transaction:
              // manager.save(newUser);
              const entity = ApolloUser.create(newUser)
              await ApolloUser.save(entity)
              // await ApolloUser.create(newUser).save();
              //await queryRunner.manager.save(newUser);
              console.log('User added');
              // await queryRunner.manager.save(userRole);
              // await UserRole.save(userRole);
              // await ApolloUser.create(newUser).save();
              //await queryRunner.manager.save(newUser);
              const entity1 = ApolloUser.create(newUser)
              await ApolloUser.save(entity1)
              console.log('User added');

            // await queryRunner.manager.getCustomRepository(GrailsUserRepository).addNewUserRepo(newUser);
            // // Get user from database and return it (now it contains userId)
            // // let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });

            // await queryRunner.manager.getCustomRepository(GrailsUserRepository).addNewUserRoleRepo(userRole);
              // commit transaction now:
              await queryRunner.commitTransaction();
              console.log('COMMITTED!')
          } catch (err) {
              // since we have errors let's rollback changes we made
              console.log('ROLLBACK!!!!' + err)
              await queryRunner.rollbackTransaction();
          } finally {
              // you need to release query runner which is manually created:
              console.log('RELEASE')
              await queryRunner.release();
          }


          // Insert user and user role in one transaction
          // // TRANSACTIONS ARE NOT WORKING !!!!!!!! INSIDE TRANSACTION YOU CANNOT MAKE QUERIES OTHERWISE TRANSACTIONS ARE NOT WORKING
          // dbConn.transaction(async entityManager => {
          //   // const grailsUserRepo = entityManager.getCustomRepository(GrailsUserRepository);
          //   // await grailsUserRepo.addNewUserRepo(newUser);
          //   // // Get user from database and return it (now it contains userId)
          //   // let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });

          //   // TODO: Role information is now hard-coded
          //   let userRole = new UserRole();
          //   userRole.userId = 43; //justAddedUser.id;
          //   //userRole.roleId = 3; // TODO: HARDCODE VALUE FOR DEMO ONLY
          //   await ApolloUser.save(newUser);
          //   await UserRole.save(userRole);
          //   //await grailsUserRepo.addNewUserRoleRepo(userRole);
          // });
        //   await getManager().transaction(async transactionalEntityManager => {
        //     await transactionalEntityManager.save(newUser);
        //     let userRole = new UserRole();
        //     userRole.userId = 46; //justAddedUser.id;
        //     userRole.roleId = 3; // TODO: HARDCODE VALUE FOR DEMO ONLY
        //     await transactionalEntityManager.save(userRole);
        //     // ...
        // });

          // Get user from database and return it (now it contains userId)
          let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });
          return response.status(HttpStatus.OK).json(justAddedUser);
      } catch(error) {
          throw new HttpException('Error in addNewUser() : ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
      }        
    }

  /**
   * Check if new user does not exist in database and if not then add it
   * @param newUser New user information
   * @param response 
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of user already exists then return error message with 'HttpStatus.CONFLICT'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
    async addNewUser(newUser: ApolloUser, response: Response): Promise<Response> {
      var dbConn;

      try {
        // Check if there is already same username in db
        let foundUser = await ApolloUser.findOne({ userName: newUser.userName });
        if (foundUser != null) {
          const msg = 'Username ' + newUser.userName + ' already exists!'
          this.logger.error(msg);       
          return response.status(HttpStatus.CONFLICT).json({status: HttpStatus.CONFLICT, message: msg})
        } 
  
          // Create connection
          const pool = this.mysql.createPool(this.mySqlConfig.mysql_config);
          this.logger.verbose("Creating connection...");
          dbConn = await pool.getConnection();
          this.logger.verbose("Starting transaction...");
          await dbConn.beginTransaction();  

          // Add new user
          const addUserSql = "INSERT INTO grails_user (version, inactive, first_name, last_name, username, password_hash) VALUES (?, ?, ?, ?, ?, ?)";
          const addUserArgs = [newUser.version, newUser.inactive, newUser.firstName, newUser.lastName, newUser.userName, newUser.passwordHash];            
          const queryResultAddUser = await dbConn.query(addUserSql, addUserArgs);
          const newUserId =  queryResultAddUser[0].insertId;
          this.logger.debug("Added new user with id = " + newUserId);

          // Add user role
          // TODO: Role information is now hard-coded
          let userRole = new UserRole();
          userRole.userId = newUserId;
          userRole.roleId = 3; // TODO: HARDCODE VALUE FOR DEMO ONLY
          const addRoleSql = "INSERT INTO grails_user_roles (user_id, role_id) VALUES (?, ?)";
          const addRoleArgs = [userRole.userId, userRole.roleId];                        
          const queryResultAddRole = await dbConn.query(addRoleSql, addRoleArgs);
          this.logger.debug("Added role " + userRole.roleId + ' for new user');

          await dbConn.commit();
          this.logger.verbose('Committed');
          dbConn.release();
          // Get user from database and return it (now it contains userId)
          let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });
          return response.status(HttpStatus.OK).json({status: HttpStatus.OK, message: justAddedUser});
        } catch (err) {
          this.logger.error(`ERROR when creating new user: ${err.message}`, err);
          dbConn.rollback();
          dbConn.release();
          this.logger.debug('Rollback done');
          throw new HttpException('ERROR in addNewUser() : ' + err, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
}
