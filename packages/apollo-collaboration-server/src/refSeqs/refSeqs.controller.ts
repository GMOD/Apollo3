import { Body, Controller, Get, Param, Post } from '@nestjs/common'

import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'
import { RefSeq } from './schemas/refSeq.schema'

@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  @Post()
  async create(@Body() createRefSeqDto: CreateRefSeqDto) {
    await this.refSeqsService.create(createRefSeqDto)
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
