import { Database } from "../utils/database";
import {Connection, EntityRepository, Repository} from "typeorm";
import Grails_user from "../entities/grails_user.entity";
import { HttpStatus } from "@nestjs/common";
import { Response } from 'express';

@EntityRepository(Grails_user)
export class GrailsUserRepository extends Repository<Grails_user> {

    // Get all users from database - using embedded SQL
    async getAllUsernames(response: Response): Promise<Response> {
        const database = new Database();
        try {
            // TODO: Put connection name to property file
            const dbConn: Connection = await database.getConnection('testConnection');
            if (dbConn.isConnected) {                
                let returnValue = await dbConn.manager.query('SELECT DISTINCT USERNAME FROM GRAILS_USER');
                if (returnValue != null) {
                    console.log(returnValue);
                    return response.status(HttpStatus.OK).json(returnValue);
                } else {
                    console.error('getAllUsernames(): No data found');
                    return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
                }
            } else {
                console.error('No connection to database in getUsernamesFromDatabase()');
                return response.status(HttpStatus.UNAUTHORIZED).json({status: HttpStatus.UNAUTHORIZED, message: 'No connection to database in getUsernamesFromDatabase()'});  
            }    
        } catch(error) {
            console.error('Error in getUsernamesFromDatabase(): ' + error);
            return response.status(HttpStatus.NOT_ACCEPTABLE).json({status: HttpStatus.NOT_ACCEPTABLE, message: 'Error in getUsernamesFromDatabase(): ' + error});  
        }
    }    

    // Find user by LastName - using ORM
    async findByLastName(last_name: string, response: Response): Promise<any> {
        console.log('Find by lastname : "' + last_name + '"');
        let returnValue = await this.findOne({ last_name });
        if (returnValue != null) {
            console.log(returnValue);
            return response.status(HttpStatus.OK).json(returnValue);
        } else {
            console.error('getAllUsernames(): No data found');
            return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
        }
    }

}