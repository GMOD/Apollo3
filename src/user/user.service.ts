import { HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Response } from 'express';
import Grails_user from '../entities/grails_user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
  constructor(
      @InjectRepository(Grails_user)
      private grailsUsersRepository: Repository<Grails_user>,
  ) {};
    

  // // Get all users using ORM  - THE MOST COMPRESSED METHOD
  // findAll(): Promise<Grails_user[]> {
  //   return this.grailsUsersRepository.find();
  // }
  
  // Get all users using ORM  - WITH EXCEPTION HANDLING
  async getAllUsersORM(response: Response): Promise<Response> {
    try {
      let returnValue = await Grails_user.find();
      if (returnValue != null) {
        console.log(returnValue);
        return response.status(HttpStatus.OK).json(returnValue);
      } else {
        console.error('getAllUsersORM(): No data found');
        return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
      }
    } catch(error) {
        return response.status(HttpStatus.NOT_ACCEPTABLE).json({status: HttpStatus.NOT_ACCEPTABLE, message: 'Error in getAllUsersORM() : ' + error});
    }        
  }
}
