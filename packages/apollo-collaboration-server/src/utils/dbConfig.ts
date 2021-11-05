// This is needed for MySQL connection pooling
export const mysql_config = {
  host: 'localhost',
  user: 'apollo',
  password: 'apollo123',
  database: 'apollo-production',
}

//  This is needed for TypeORM
export const mysql_config_entities = {
  type: 'mysql',
  name: 'testConnection',
  host: 'localhost',
  port: 3306,
  username: 'apollo',
  password: 'apollo123',
  database: 'apollo-production',
  entities: ['../entity/**/*.ts'], //entities: [ApolloUser, UserRole],
  synchronize: false,
}

// This is just for test purpose....
export default () => ({
  type: 'mysql',
  name: 'default',
  host: 'localhost',
  port: 3306,
  username: 'apollo',
  password: 'apollo123',
  database: 'apollo-production',
  autoLoadEntities: true,
  synchronize: false,
})
