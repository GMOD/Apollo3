import { Database } from "../utils/database";
import {Connection, EntityRepository, Repository} from "typeorm";
import ApolloUser from "../entity/grails_user.entity";
import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Response } from 'express';

/**
 * Custom repository for grails_user -table
 */
@EntityRepository(ApolloUser)
export class GrailsUserRepository extends Repository<ApolloUser> {
    private readonly logger = new Logger(GrailsUserRepository.name);
    /**
     * Get all usernames from database - using embedded SQL
     * @param response 
     * @returns Return list of usernames with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
     async getAllUsernames(response: Response): Promise<Response> {
        const database = new Database();
        try {
            // TODO: Put connection name to property file
            const dbConn: Connection = await database.getConnection('testConnection');
            if (dbConn.isConnected) {                
                let returnValue = await dbConn.manager.query('SELECT DISTINCT USERNAME FROM GRAILS_USER');
                if (returnValue != null) {
                    this.logger.log('Data found (getAllUsernames)');
                    this.logger.debug(JSON.stringify(returnValue));            
                    return response.status(HttpStatus.OK).json(returnValue);
                } else {
                    this.logger.log('No data found (getAllUsernames)');
                    throw new HttpException('No data found (getAllUsernames)', HttpStatus.NOT_FOUND);
                    //return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
                }
            } else {
                this.logger.error('No connection to database (getAllUsernames)');
                throw new HttpException('No connection to database in getUsernamesFromDatabase()', HttpStatus.INTERNAL_SERVER_ERROR);
                // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});  
            }    
        } catch(error) {
            this.logger.error('Error in getUsernamesFromDatabase(): ' + error);
            throw new HttpException('Error in getUsernamesFromDatabase(): ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
            // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});  
        }
    }    

    /**
     * Find user by LastName - using ORM
     * @param response 
     * @returns Return user with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
    async findByLastName(lastname: string, response: Response): Promise<any> {
        this.logger.log('Find by lastname : "' + lastname + '"');
        let returnValue = await this.findOne({ lastName: lastname });
        if (returnValue != null) {
            this.logger.log('Data found (findByLastName)');
            this.logger.debug(JSON.stringify(returnValue));
            return response.status(HttpStatus.OK).json(returnValue);
        } else {
            this.logger.log('No data found (findByLastName)');
            throw new HttpException('No data found (findByLastName)', HttpStatus.NOT_FOUND);
            //return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
        }
    }

    /**
     * Get all users and roles from database - using embedded SQL
     * @param response 
     * @returns Return list of users and roles with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
     async getUsersAndRoles(response: Response): Promise<Response> {
        const database = new Database();
        try {
            // TODO: Put connection name to property file
            const dbConn: Connection = await database.getConnection('testConnection');
            const StringBuilder = require("string-builder");
            const sqlQuery = new StringBuilder('');
            // SQL query to get users and roles    
            sqlQuery.appendLine('SELECT DISTINCT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.METADATA, U.METADATA, R.ROLE_ID ');
            sqlQuery.appendLine('FROM GRAILS_USER U, GRAILS_USER_ROLES R ');
            sqlQuery.appendLine('WHERE U.ID = R.USER_ID ');
            if (dbConn.isConnected) {                
                let returnValue = await dbConn.manager.query(sqlQuery.toString());
                if (returnValue != null) {
                    this.logger.log('Data found (getUsersAndRoles)');
                    this.logger.debug(JSON.stringify(returnValue));            
                    return response.status(HttpStatus.OK).json(returnValue);
                } else {
                    this.logger.log('No data found (getUsersAndRoles)');
                    throw new HttpException('No data found (getUsersAndRoles)', HttpStatus.NOT_FOUND);
                    //return response.status(HttpStatus.NOT_FOUND).json({status: HttpStatus.NOT_FOUND, message: 'No data found'});  
                }
            } else {
                this.logger.error('No connection to database (getUsersAndRoles)');
                throw new HttpException('No connection to database in getUsersAndRoles()', HttpStatus.INTERNAL_SERVER_ERROR);
                // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'No connection to database in getUsernamesFromDatabase()'});  
            }    
        } catch(error) {
            this.logger.error('Error in getUsersAndRoles(): ' + error);
            throw new HttpException('Error in getUsersAndRoles(): ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
            // return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error in getUsernamesFromDatabase(): ' + error});  
        }
    }    

}