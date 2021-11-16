import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthenticateModule } from './authentication/authenticate.module'
import { UserModule } from './controller/user/user.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { APP_GUARD } from '@nestjs/core'
import { getConnectionOptions } from 'typeorm'
import { RolesGuard } from './utils/role/role.guards'
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked'

initializeTransactionalContext() // Initialize cls-hooked

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    AuthenticateModule,
    UserModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: configService.get<'mysql'>('TYPEORM_CONNECTION'),
        host: configService.get<string>('TYPEORM_HOST'),
        port: parseInt(configService.get<string>('TYPEORM_PORT'), 10),
        username: configService.get<string>('TYPEORM_USERNAME'),
        password: configService.get<string>('TYPEORM_PASSWORD'),
        database: configService.get<string>('TYPEORM_DATABASE'),
        synchronize: JSON.parse(
          configService.get<string>('TYPEORM_SYNCHRONIZE'),
        ),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
