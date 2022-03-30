import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common'

import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { UpdateRefSeqDto } from './dto/update-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'

@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  @Post()
  create(@Body() createRefSeqDto: CreateRefSeqDto) {
    return this.refSeqsService.create(createRefSeqDto)
  }

  @Get()
  findAll() {
    return this.refSeqsService.findAll()
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
