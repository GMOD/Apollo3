import { createReadStream } from 'fs'

import { Controller, Get, Logger, Param, StreamableFile } from '@nestjs/common'

import { AssembliesService } from './assemblies.service'

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
}
