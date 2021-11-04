import { Connection, ConnectionManager, getConnectionManager } from 'typeorm';

export class Database {
  private connectionManager: ConnectionManager;
  private readonly mySqlConfig = require('../utils/dbConfig');

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
        // Read values from property file
        const connection = connectionManager.create(this.mySqlConfig.mysql_config_entities);
        await connection.connect(); 
        return connection;
    }
  }
}

