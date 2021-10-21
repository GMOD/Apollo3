import Grails_user from '../entity/grails_user.entity';
import { Connection, ConnectionManager, getConnectionManager } from 'typeorm';

export class Database {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = getConnectionManager();
  }

  /**
   * 
   * @param name Get database connection
   * @returns Database connection object
   */
  public async getConnection(name: string): Promise<Connection> {
    const CONNECTION_NAME: string = name;
    let connection: Connection;
    const hasConnection = this.connectionManager.has(CONNECTION_NAME);
    if (hasConnection) {
      connection = this.connectionManager.get(CONNECTION_NAME);
      if (!connection.isConnected) {
        connection = await connection.connect();
      }
    } else {
        const connectionManager = new ConnectionManager();
        // TODO: Read values from property file
        const connection = connectionManager.create({
            type: "mysql",
            name: 'testConnection',
            host: "localhost",
            port: 3306,
            username: 'apollo',
            password: 'apollo123',
            database: 'apollo-production',
            entities: [Grails_user],
            synchronize: false
            });
        await connection.connect(); 
        return connection;
    }
  }
}

