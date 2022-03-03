import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { GFF3Schema } from '../model/gff3.model'
import { ProductSchema } from '../model/product.model'
import { FileHandlingController } from './fileHandling.controller'
import { FileHandlingService } from './fileHandling.service'

// const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  controllers: [FileHandlingController],
  providers: [FileHandlingService],
  imports: [
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
    MongooseModule.forFeature([{ name: 'Product', schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: 'GFF3', schema: GFF3Schema }]),
  ],
})
export class FileHandlingModule {}
