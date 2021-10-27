import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Connection, getConnection, Repository } from 'typeorm';
import { Response } from 'express';
import ApolloUser from '../../entity/grails_user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from '../../utils/database';
import UserRole from '../../entity/userRole.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

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
    async addNewUser(newUser: ApolloUser, response: Response): Promise<Response> {
      try {
        let foundUser = await ApolloUser.findOne({ userName: newUser.userName });
        if (foundUser != null) {
          let msg: string = 'Username ' + newUser.userName + ' already exists!'
          this.logger.error(msg);
          return response.status(HttpStatus.CONFLICT).json({status: HttpStatus.CONFLICT, message: msg});
        } 
        await ApolloUser.save(newUser);
        this.logger.debug('Added new user: ' + JSON.stringify(newUser));

        // Get user from database and return it (now it contains userId)
        let justAddedUser = await ApolloUser.findOne({ userName: newUser.userName });
        return response.status(HttpStatus.OK).json(justAddedUser);
      } catch(error) {
          throw new HttpException('Error in addNewUser() : ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
      }        
    }
  
}
