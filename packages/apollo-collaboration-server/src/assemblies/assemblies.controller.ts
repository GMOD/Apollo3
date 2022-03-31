import { createReadStream } from 'fs'

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common'
import { Assembly } from 'apollo-shared'

import { AssembliesService } from './assemblies.service'
import { CreateAssemblyDto } from './dto/create-assembly.dto'

@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}
  private readonly logger = new Logger(AssembliesController.name)

  /**
   * Download GFF3 data from database to client
   * @param assemblyId - Assembly id
   * @returns GFF3 file if given assemblyId existed in db. Otherwise throw exception
   */
  // @UseGuards(JwtAuthGuard)
  @Get('/downloadAssembly/:assemblyId')
  getFile(@Param('assemblyId') assemblyId: string) {
    this.logger.debug(
      `Starting to download GFF3 data from assembly '${assemblyId}'`,
    )
    this.assembliesService
      .downloadAssemblyByAssemblyId(assemblyId)
      .then((msg) => {
        this.logger.debug(`Now downloading file: ${msg}`)
        const file = createReadStream(msg)
        return new StreamableFile(file)
      })
  }

  @Post()
  async create(@Body() createAssemblyDto: CreateAssemblyDto) {
    this.logger.debug(
      `Starting to add new assembly: ${JSON.stringify(createAssemblyDto)}`,
    )
    const assembly = await this.assembliesService.create(createAssemblyDto)
    this.logger.debug(`Assembly ${assembly} created`)
  }

  @Get()
  async getAll(): Promise<Assembly[]> {
    return this.assembliesService.findAll()
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<Assembly> {
    return this.assembliesService.find(id)
  }
}
