import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked'

import { AuthenticationModule } from './authentication/authentication.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
import { UsersModule } from './users/users.module'
import { RolesGuard } from './utils/role/role.guards'

initializeTransactionalContext() // Initialize cls-hooked

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
    AuthenticationModule,
    UsersModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const port = configService.get<string>('TYPEORM_PORT')
        if (!port) {
          throw new Error('No TYPEORM_PORT found in .env file')
        }
        const synchronize = configService.get<string>('TYPEORM_SYNCHRONIZE')
        if (!synchronize) {
          throw new Error('No TYPEORM_SYNCHRONIZE found in .env file')
        }
        return {
          type: configService.get<'mysql'>('TYPEORM_CONNECTION'),
          host: configService.get<string>('TYPEORM_HOST'),
          port: parseInt(port, 10),
          username: configService.get<string>('TYPEORM_USERNAME'),
          password: configService.get<string>('TYPEORM_PASSWORD'),
          database: configService.get<string>('TYPEORM_DATABASE'),
          synchronize: JSON.parse(synchronize),
          autoLoadEntities: true,
        }
      },
      inject: [ConfigService],
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
