import { Module } from '@nestjs/common'
import { AuthenticateModule } from './authentication/authenticate.module'
import { UserModule } from './controller/user/user.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { APP_GUARD } from '@nestjs/core'
import { RolesGuard } from './utils/role/role.guards'
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked'
import { FileHandlingModule } from './fileHandling/fileHandling.module'

initializeTransactionalContext() // Initialize cls-hooked

@Module({
  imports: [
    FileHandlingModule,
    AuthenticateModule,
    UserModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      name: 'default',
      host: 'localhost',
      port: 3306,
      username: 'apollo',
      password: 'apollo123',
      database: 'apollo-production',
      autoLoadEntities: true,
      synchronize: false,
    }),
    FileHandlingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
