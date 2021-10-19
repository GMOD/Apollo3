import { Module } from '@nestjs/common';
import { AuthenticateModule } from './authentication/authenticate.module';
import { UserModule } from './controller/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  // Backup copy of MySQL information
  // imports: [AuthenticateModule, UserModule, 
  //   TypeOrmModule.forRoot({
  //     type: 'mysql',
  //     name: 'default',
  //     host: 'localhost',
  //     port: 3306,
  //     username: 'apollo',
  //     password: 'apollo123',
  //     database: 'apollo-production',
  //     autoLoadEntities: true,
  //     synchronize: false
  //   }),],
  imports: [AuthenticateModule, UserModule, 
       TypeOrmModule.forRoot({
      type: 'mysql',
      name: 'default',
      host: 'localhost',
      port: 3306,
      username: 'apollo',
      password: 'apollo123',
      database: 'apollo-production',
      autoLoadEntities: true,
      synchronize: false
    }),],


})
export class AppModule {}
