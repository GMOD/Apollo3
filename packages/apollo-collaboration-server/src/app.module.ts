import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from './assemblies/assemblies.module'
import { AuthenticationModule } from './authentication/authentication.module'
import { ChangeModule } from './change/change.module'
import { FeaturesModule } from './features/features.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
import { RefseqsModule } from './refseqs/refseqs.module'
import { RolesGuard } from './utils/role/role.guards'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    FileHandlingModule,
    ChangeModule,
    AssembliesModule,
    FeaturesModule,
    RefseqsModule,
    MongooseModule.forRoot(
      'mongodb+srv://apollo:apollo123@cluster0.8a7mi.mongodb.net/apolloDb?retryWrites=true&w=majority'
    )
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
