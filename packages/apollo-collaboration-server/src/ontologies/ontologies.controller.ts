import { Controller, Get, Logger, Param } from '@nestjs/common'

import { Public } from '../utils/jwt-auth.guard'
import { OntologiesService } from './ontologies.service'

@Public()
@Controller('ontologies')
export class OntologiesController {
  constructor(private readonly ontologiesService: OntologiesService) {}
  private readonly logger = new Logger(OntologiesController.name)

  /**
   * Get children's allowed feature types by parent type. Data is retrieved from OBO JSON file
   * @param parentType - feature's parent type
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/descendants/:featureType')
  getTypesFromJson(@Param('featureType') featureType: string) {
    this.logger.debug(
      `Get possible children types (from OBO-JSON) by parent type: "${featureType}"`,
    )
    return this.ontologiesService.getDescendants(featureType)
  }

  /**
   * Get children's allowed feature types by parent type. Data is retrieved from OBO JSON file
   * @param parentType - feature's parent type
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/go/findAll')
  goFindAll() {
    return this.ontologiesService.goFindAll()
  }

  /**
   * Get children's allowed feature types by parent type. Data is retrieved from OBO JSON file
   * @param parentType - feature's parent type
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/go/findByStr/:str')
  goFindByStr(@Param('str') str: string) {
    return this.ontologiesService.goFindByStr(str.toUpperCase())
  }
}
