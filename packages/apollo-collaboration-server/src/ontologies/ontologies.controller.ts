import fs from 'fs'
import path from 'path'

import { Controller, Get, Logger, Param } from '@nestjs/common'
import { OboJson } from 'apollo-common'

import { Public } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
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
  @Validations(Role.ReadOnly)
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
    this.logger.debug(`Get all possible GO terms`)

    return this.ontologiesService.goFindAll()
    // return this.ontologiesService.getDescendants(featureType)
  }

  /**
   * Get children's allowed feature types by parent type. Data is retrieved from OBO JSON file
   * @param parentType - feature's parent type
   * @returns Return 'HttpStatus.OK' and the allowed children feature types if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/dummy/:featureType')
  dummyFromJson(@Param('featureType') featureType: string) {
    this.logger.debug(
      `Get possible children types (from OBO-JSON) by parent type: "${featureType}"`,
    )

    const ontologyFile = path.join('..', '..', 'data', 'go.json')
    try {
      const ontologyLocation = path.resolve(__dirname, ontologyFile)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      const ontology: OboJson = ontologyJson
      // Iterate over the nodes and edges in the JSON file
      for (const node of ontology.graphs[0].nodes) {
        if (node.lbl === 'organelle transport along microtubule') {
          this.logger.debug?.(
            `*************** Parent type is "organelle transport along microtubule", OboJson node is "${node.id}"`,
          )
          // parentId = node.id
          break
        }
      }
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }

    return 'JUU'
    // return this.ontologiesService.getDescendants(featureType)
  }
}
