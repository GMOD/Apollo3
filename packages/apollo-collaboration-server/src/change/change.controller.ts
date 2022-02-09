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
  constructor(private readonly changeService: ChangeService) {}

  // // THIS WORKS FINE
  // //   @UseGuards(JwtAuthGuard)
  // @Post('/submitchange')
  // submitChange(@Req() request: Request) {
  //   const change = request.body as ChangeObjectTmp
  //   return this.changeService.changeLocationEnd(change)
  // }

  // THIS CAUSES EXCEPTION
  //   @UseGuards(JwtAuthGuard)
  @Post('/submitchange1')
  submitChange1(@Body() serializedChange: SerializedChange) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    const change = LocationEndChange.fromJSON(serializedChange)
    this.logger.debug(`change=${JSON.stringify(change)}`)
    return JSON.stringify(serializedChange)
  }
}
