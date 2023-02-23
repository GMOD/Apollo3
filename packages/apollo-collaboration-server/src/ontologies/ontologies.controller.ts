import { Controller, Get, Logger, Param } from '@nestjs/common'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { OntologiesService } from './ontologies.service'

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
  @Validations(Role.ReadOnly)
  @Get('/json/:parentType')
  getTypesFromJson(@Param('parentType') parentType: string) {
    this.logger.debug(
      `Get possible children types (from OBO-JSON) by parent type: "${parentType}"`,
    )
    return this.ontologiesService.getTypesUsingOperation(parentType)
  }
}
