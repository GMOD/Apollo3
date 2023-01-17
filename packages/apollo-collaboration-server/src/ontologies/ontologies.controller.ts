import { readFile } from 'fs'
import { join } from 'path'

import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import {
  FileStorageEngine,
  UploadedFile as UploadedApolloFile,
} from '../utils/FileStorageEngine'
import { OntologiesService } from './ontologies.service'

// import { parse, stanzaParse } from 'bionode-obo'
import par = require('bionode-obo')

@Controller('ontologies')
export class OntologiesController {
  constructor(private readonly ontologiesService: OntologiesService) {}
  private readonly logger = new Logger(OntologiesController.name)

  /**
   * Get children's allowed feature types by parent type.
   * @param parentType - string
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  // @UseGuards(JwtAuthGuard)
  // @Validations(Role.ReadOnly)
  @Get(':parentType')
  getChildrenTypes(@Param('parentType') parentType: string) {
    this.logger.debug(
      `Get allowed children's feature types by parent type: ${parentType}`,
    )
    return this.ontologiesService.findChildrenTypesByParentType(parentType)
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new InternalServerErrorException(
        'No FILE_UPLOAD_FOLDER found in .env file',
      )
    }

    const tempFullFileName = join(FILE_UPLOAD_FOLDER, `${file.originalname}`)
    this.logger.debug(`PATH: "${tempFullFileName}"`)
    this.ontologiesService.loadOntology(tempFullFileName)
  }
}
