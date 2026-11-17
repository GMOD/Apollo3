import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
  Response,
  StreamableFile,
} from '@nestjs/common'
import { ApiProduces, ApiQuery } from '@nestjs/swagger'
import type { Response as ExpressResponse } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { GetExportIDDto } from './dto/get-export-id.dto.js'
import { ExportService } from './export.service.js'

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Start an export of an assembly as GFF3
   *
   * Returns an export ID to pass to `GET /export`. The ID is valid for 5
   * minutes.
   */
  @Validations(Role.ReadOnly)
  @Get('getID')
  async getExportID(@Query() request: GetExportIDDto) {
    const exportDoc = await this.exportService.getExportID(request.assembly)
    return { exportID: exportDoc._id }
  }

  /**
   * Download an assembly as GFF3
   *
   * Doesn't need a token, since the export ID from `GET /export/getID` already
   * grants access. Streams the GFF3 as a file attachment.
   * @param exportID - Export ID from `GET /export/getID`
   */
  @ApiQuery({
    name: 'includeFASTA',
    required: false,
    description: "Add the assembly's sequences in a `##FASTA` section",
    schema: { type: 'boolean', default: false },
  })
  @ApiQuery({
    name: 'fastaWidth',
    required: false,
    description: 'Line width of the FASTA sequences',
    schema: { type: 'integer', default: 80 },
  })
  @Validations(Role.None)
  @ApiProduces('application/text')
  @Get()
  async exportGFF3(
    // @Query()
    @Query('exportID') exportID: string,
    @Query('includeFASTA', new DefaultValuePipe(false), ParseBoolPipe)
    includeFASTA: boolean,
    @Query('fastaWidth', new DefaultValuePipe(80), ParseIntPipe)
    fastaWidth: number,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const [stream, assembly] = await this.exportService.exportGFF3(exportID, {
      includeFASTA,
      fastaWidth,
    })
    const assemblyName = await this.exportService.getAssemblyName(assembly)
    res.set({
      'Content-Type': 'application/text',
      'Content-Disposition': `attachment; filename="${assemblyName}_apollo.gff3"`,
    })
    // TODO: remove ts-ignores below after a resolution for this issue is
    // released: https://github.com/nestjs/nest/issues/10681
    return new StreamableFile(stream).setErrorHandler((error, response) => {
      if (response.destroyed) {
        return
      }
      if (response.headersSent) {
        // TODO: maybe broadcast message to user that they shouldn't trust the
        // exported GFF3? From the client side there's no way to tell this
        // stream terminated early.
        response.end()
        return
      }
      response.statusCode = 400
      response.send(error.message)
    })
  }
}
