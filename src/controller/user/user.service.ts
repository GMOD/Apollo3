import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Response } from 'express';
import Grails_user from '../../entity/grails_user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
      @InjectRepository(Grails_user)
      private grailsUsersRepository: Repository<Grails_user>,
  ) {};
    

  /**
   * Get all users using ORM
   * @param response 
   * @returns Return list of users with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async getAllUsersORM(response: Response): Promise<Response> {
    try {
      let returnValue = await Grails_user.find();
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
}
