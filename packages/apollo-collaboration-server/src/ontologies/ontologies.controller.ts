import { join } from 'path'

import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { OntologiesService } from './ontologies.service'

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
      `Get allowed children's feature types for parent type: "${parentType}"`,
    )
    return this.ontologiesService.findChildrenTypesByParentType(parentType)
  }

  /**
   * Get all possible feature types for given feature.
   * @param parentType - string
   * @returns Return 'HttpStatus.OK' and the allowed feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Validations(Role.ReadOnly)
  @Get('/possibleTypes/:featureId')
  async getPossibleTypes(@Param('featureId') featureId: string) {
    this.logger.debug(
      `Get possible feature types for featureId: "${featureId}"`,
    )
    const eka = await this.ontologiesService.getPossibleFeatureTypes(featureId)
    return eka
  }

  /**
   * Get children's allowed feature types by parent type.
   * @param parentType - string
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  // @UseGuards(JwtAuthGuard)
  // @Validations(Role.ReadOnly)
  @Get('/json/:parentType')
  getTypesFromJson(@Param('parentType') parentType: string) {
    this.logger.debug(`Get possible children types (from OBO-JSON) by parent type: "${parentType}"`)
    return this.ontologiesService.featureTypeFromJson(parentType)
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
