import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { GetSequenceDto } from '../refSeqChunks/dto/get-sequence.dto'
import { RefSeqChunksService } from '../refSeqChunks/refSeqChunks.service'
import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { UpdateRefSeqDto } from './dto/update-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'

@Controller('refSeqs')
export class RefSeqsController {
  constructor(
    private readonly refSeqsService: RefSeqsService,
    private readonly refSeqChunksService: RefSeqChunksService,
  ) {}

  private readonly logger = new Logger(RefSeqsController.name)

  @Post()
  create(@Body() createRefSeqDto: CreateRefSeqDto) {
    return this.refSeqsService.create(createRefSeqDto)
  }

  @Get()
  findAll() {
    return this.refSeqsService.findAll()
  }

  @Get('getSequence')
  getFeatures(@Query() request: GetSequenceDto) {
    this.logger.debug(`getSequence: ${JSON.stringify(request)}`)
    return this.refSeqChunksService.getSequence(request)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refSeqsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRefSeqDto: UpdateRefSeqDto) {
    return this.refSeqsService.update(id, updateRefSeqDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.refSeqsService.remove(id)
  }
}
