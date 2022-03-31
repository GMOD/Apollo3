import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common'
import { RefSeq } from 'apollo-shared'

import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'

@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}
  private readonly logger = new Logger(RefSeqsController.name)

  @Post()
  async create(@Body() createRefSeqDto: CreateRefSeqDto) {

    this.logger.debug(
      `Starting to add new RefSeq: ${JSON.stringify(createRefSeqDto)}`,
    )
    const refSeq = await this.refSeqsService.create(createRefSeqDto)
    this.logger.debug(`RefSeq ${refSeq} created`)
  }

  @Get()
  async getAll(): Promise<RefSeq[]> {
    return this.refSeqsService.findAll()
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<RefSeq> {
    return this.refSeqsService.find(id)
  }
}
