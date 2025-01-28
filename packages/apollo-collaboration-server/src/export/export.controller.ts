/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Logger,
  Query,
  Response,
  StreamableFile,
} from '@nestjs/common'
import { Response as ExpressResponse } from 'express'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ExportService } from './export.service'

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  private readonly logger = new Logger(ExportController.name)

  /**
   * Get and ID to be used with exportGFF3. ID will be valid for 5 minutes.
   * @param request -
   * @returns The ID of an export that will be valid for 5 minutes
   */
  @Validations(Role.ReadOnly)
  @Get('getID')
  async getExportID(@Query() request: { assembly: string }) {
    const exportDoc = await this.exportService.getExportID(request.assembly)
    return { exportID: exportDoc._id }
  }

  /* Export GFF3 from database.
   * e.g: curl http://localhost:3999/features/exportGFF3?exportID=624a7e97d45d7745c2532b01
   *
   * @param request -
   * @param res -
   * @returns A StreamableFile of the GFF3
   */
  @Validations(Role.None)
  @Get()
  async exportGFF3(
    @Query()
    request: {
      exportID: string
      withFasta: 'True' | 'False'
      fastaWidth?: number
    },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const { exportID, withFasta, ...rest } = request
    if (!['True', 'False'].includes(withFasta)) {
      throw new Error(`withFasta must be "True" or "False", got: ${withFasta}`)
    }
    const [stream, assembly] = await this.exportService.exportGFF3(exportID, {
      withFasta: withFasta === 'True',
      ...rest,
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
