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
  LocationEndChange,
  SerializedChange,
  changeRegistry, Change
} from '../../../apollo-shared'
import { ChangeObjectTmp } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(private readonly changeService: ChangeService) {}

//   @UseGuards(JwtAuthGuard)
  @Post('/submitchange')
    submitChange1(@Req() request: Request) {
        //   submitChange1(@Body() serializedChange: SerializedChange) {
    //    changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    // const change = LocationEndChange.fromJSON(serializedChange)
    // const change = this.fromJSON(serializedChange)
    // this.fileService.loadGFF3FileIntoCache(
    //   await this.fileService.saveNewFile(file),
    // )

    // this.logger.debug(`change=${JSON.stringify()}`)
    const change = request.body as ChangeObjectTmp;
    // this.logger.debug(`REQ=${JSON.stringify(request)}`)
    this.logger.debug(`BODY=${JSON.stringify(request.body)}`)
    // this.changeService.changeLocationEnd(serializedChange)
    // return JSON.stringify(serializedChange)

    // this.logger.debug(`change=${JSON.stringify(serializedChange)}`)
    // const toDo = serializedChange as ChangeObjectTmp;
    this.logger.debug(`TODO=${JSON.stringify(change)}`)    
    return this.changeService.changeLocationEnd(change)
    // return JSON.stringify(serializedChange)
  }

}
