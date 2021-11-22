import {
  Connection,
  ConnectionManager,
  ConnectionOptions,
  getConnectionManager,
} from 'typeorm'

export class Database {
  private connectionManager: ConnectionManager
  private readonly connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
    this.connectionManager = getConnectionManager()
  }

  /**
   *
   * @param name Get database connection
   * @returns Database connection object
   */
  public async getConnection(name: string): Promise<Connection> {
    const CONNECTION_NAME: string = name
    let connection: Connection
    const hasConnection = this.connectionManager.has(CONNECTION_NAME)
    if (hasConnection) {
      connection = this.connectionManager.get(CONNECTION_NAME)
      if (!connection.isConnected) {
        connection = await connection.connect()
      }
      return connection
    } else {
      const connectionManager = new ConnectionManager()
      const connection = connectionManager.create(this.connectionOptions)
      await connection.connect()
      return connection
    }
  }
}
