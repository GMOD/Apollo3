import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Request } from 'express'

import {
  Change,
  LocationEndChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { ChangeObjectTmp } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(private readonly changeService: ChangeService) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange)
  }

  // // THIS WORKS FINE
  // //   @UseGuards(JwtAuthGuard)
  // @Post('/submitchange')
  // submitChange(@Req() request: Request) {
  //   const change = request.body as ChangeObjectTmp
  //   return this.changeService.changeLocationEnd(change)
  // }

  // THIS CAUSES EXCEPTION
  //   @UseGuards(JwtAuthGuard)
  @Post('/submitchange')
  submitChange(@Body() serializedChange: SerializedChange) {
    this.logger.debug(`1=${serializedChange.typeName}`)
    this.logger.debug(`2=${serializedChange.changedIds}`)
    this.logger.debug(`3=${JSON.stringify(serializedChange.changes)}`)
    // changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    this.logger.debug(`serializedChange=${JSON.stringify(serializedChange)}`)
    // const change = LocationEndChange.fromJSON(serializedChange)  // THIS CAUSES ERROR : TypeError: Cannot read properties of undefined (reading 'changedIds')

    // Test version to test changeLocationEnd() -method
    const testChange = JSON.parse('{"changes":[{"featureId":"282f01b8-59e8-4595-83d9-751e0f1708c2","oldEnd":3300,"newEnd":4789}]}')
    this.logger.debug(`OBJ1=${JSON.stringify(testChange)}`)
    return this.changeService.changeLocationEnd(testChange)
  }
}
