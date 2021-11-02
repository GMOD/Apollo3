export const mysql_config = {
  host     : 'localhost',
  user     : 'apollo',
  password : 'apollo123',
  database : 'apollo-production'
};

export const mysql_config_entities = {
    type: "mysql",
    name: 'testConnection',
    host: "localhost",
    port: 3306,
    username: 'apollo',
    password: 'apollo123',
    database: 'apollo-production',
    //entities: [ApolloUser, UserRole],
    entities: ['../entity/**/*.ts'],
    synchronize: false
};

