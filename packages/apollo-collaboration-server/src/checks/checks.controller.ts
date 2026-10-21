import { Controller, Get, Logger, Param, Query, Req } from '@nestjs/common'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { ChecksService } from './checks.service.js'

@Validations(Role.ReadOnly)
@Controller('checks')
export class ChecksController {
  constructor(
    private readonly checksService: ChecksService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(ChecksController.name)

  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assembly',
    optional: true,
  })
  @Get()
  async findAll(
    @Query() request: { assembly?: string },
    @Req() httpRequest: RequestWithUser,
  ) {
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(httpRequest.user)
    // unicorn mistakes this for Array#find, so we ignore it
    // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
    return this.checksService.find(request, allowedAssemblyIds)
  }

  @Get('types')
  getCheckTypes() {
    return this.checksService.getChecks()
  }

  /**
   * Get all possible checkResults for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkResult -documents
   */
  @AssemblyAccess({ kind: 'refSeq', in: 'query', key: 'refSeq' })
  @Get('range')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `Get checkResults for refSeq: "${request.refSeq}", start: ${request.start}, end: ${request.end}`,
    )
    return this.checksService.findByRange(request)
  }

  /**
   * Get all possible checkResults for given featureId
   * @param id - featureId
   * @returns - an array of checkResult -documents
   */
  @AssemblyAccess({ kind: 'feature', in: 'params', key: 'id' })
  @Get(':id')
  findByFeatureId(@Param('id') id: string) {
    this.logger.debug(`Get checkResults for feature "${id}"`)
    return this.checksService.findByFeatureId(id)
  }
}
