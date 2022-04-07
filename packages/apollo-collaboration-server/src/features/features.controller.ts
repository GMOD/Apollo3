import {
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Load GFF3 file into database.
   * You can call this endpoint like: curl http://localhost:3999/features/importGFF3 -F 'file=\@./save_this_file.txt' -F 'assembly=assemblyId'
   * @param file - File to save
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  @Post('/importGFF3')
  @UseInterceptors(FileInterceptor('file'))
  async importGFF3(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { assembly: string },
  ) {
    this.logger.debug(`Adding new features for assemblyId: ${body.assembly}`)
    return this.featuresService.loadGFF3DataIntoDb(file, body.assembly)
  }
}
