/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Feature,
  type FeatureDocument,
  RefSeq,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import type { DecodedJWT } from '@apollo-annotation/shared'
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { AssemblyPermissionsService } from '../assemblyPermissions/assemblyPermissions.service.js'
import { ChecksService } from '../checks/checks.service.js'
import type { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import { Role } from '../utils/role/role.enum.js'

import type {
  FeatureCountRequest,
  GetByIndexedIdRequest,
} from './dto/feature.dto.js'

@Injectable()
export class FeaturesService {
  constructor(
    private readonly assemblyPermissionsService: AssemblyPermissionsService,
    private readonly checksService: ChecksService,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  private isAdmin(user: DecodedJWT) {
    return user.role === Role.Admin
  }

  private async ensureCanViewAssembly(user: DecodedJWT, assemblyId: string) {
    if (this.isAdmin(user)) {
      return
    }
    const canView = await this.assemblyPermissionsService.canView(
      user.id,
      assemblyId,
    )
    if (!canView) {
      throw new UnprocessableEntityException(
        `User '${user.username}' does not have view permission for assembly '${assemblyId}'`,
      )
    }
  }

  private async getAllowedAssemblyIds(
    user: DecodedJWT,
    requestedAssemblyIds?: string[],
  ): Promise<string[]> {
    if (this.isAdmin(user)) {
      return requestedAssemblyIds ?? []
    }
    const allowed =
      await this.assemblyPermissionsService.getViewableAssemblyIds(user.id)
    if (!requestedAssemblyIds) {
      return allowed
    }
    return requestedAssemblyIds.filter((assemblyId) =>
      allowed.includes(assemblyId),
    )
  }

  async findAll(user: DecodedJWT) {
    const allowedAssemblyIds = await this.getAllowedAssemblyIds(user)
    if (!this.isAdmin(user) && allowedAssemblyIds.length === 0) {
      return []
    }
    const refSeqs = await this.refSeqModel
      .find(this.isAdmin(user) ? {} : { assembly: { $in: allowedAssemblyIds } })
      .select('_id')
      .exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    return this.featureModel.find({ refSeq: { $in: refSeqIds } }).exec()
  }

  async getFeatureCount(
    featureCountRequest: FeatureCountRequest,
    user: DecodedJWT,
  ) {
    let count = 0
    const { assemblyId, end, refSeqId, start } = featureCountRequest
    const filter: Record<
      string,
      number | string | { $lte: number } | { $gte: number }
    > = { status: 0 }

    if (end) {
      filter.start = { $lte: end }
    }
    if (start) {
      filter.end = { $gte: start }
    }

    if (refSeqId) {
      const refSeqDoc = await this.refSeqModel.findById(refSeqId).exec()
      if (!refSeqDoc) {
        throw new NotFoundException(`RefSeq with id '${refSeqId}' not found`)
      }
      await this.ensureCanViewAssembly(user, refSeqDoc.assembly.toString())
      filter.refSeq = refSeqId
      count = await this.featureModel.countDocuments(filter)
    } else if (assemblyId) {
      await this.ensureCanViewAssembly(user, assemblyId)
      const refSeqs: RefSeqDocument[] = await this.refSeqModel
        .find({ assembly: assemblyId })
        .exec()

      for (const refSeq of refSeqs) {
        filter.refSeq = refSeq._id.toString()
        count += await this.featureModel.countDocuments(filter)
      }
    } else {
      if (this.isAdmin(user)) {
        count = await this.featureModel.countDocuments(filter)
      } else {
        const allowedAssemblyIds = await this.getAllowedAssemblyIds(user)
        if (allowedAssemblyIds.length === 0) {
          return 0
        }
        const refSeqs: RefSeqDocument[] = await this.refSeqModel
          .find({ assembly: { $in: allowedAssemblyIds } })
          .exec()
        for (const refSeq of refSeqs) {
          filter.refSeq = refSeq._id.toString()
          count += await this.featureModel.countDocuments(filter)
        }
      }
    }

    this.logger.debug(`Number of features is ${count}`)
    return count
  }

  async getByIndexedId(
    getByIndexedIdRequest: GetByIndexedIdRequest,
    user: DecodedJWT,
  ) {
    const { assemblies, id, topLevel } = getByIndexedIdRequest
    const requestedAssemblyIds = assemblies ? assemblies.split(',') : undefined
    const allowedAssemblyIds = await this.getAllowedAssemblyIds(
      user,
      requestedAssemblyIds,
    )
    if (!this.isAdmin(user) && allowedAssemblyIds.length === 0) {
      return []
    }

    const refSeqs = await this.refSeqModel
      .find(
        requestedAssemblyIds || !this.isAdmin(user)
          ? { assembly: { $in: allowedAssemblyIds } }
          : {},
      )
      .select('_id')
      .exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)

    const topLevelFeatures = await this.featureModel
      .find({ indexedIds: id, refSeq: { $in: refSeqIds } })
      .exec()
    if (topLevelFeatures.length === 0) {
      return []
    }
    if (topLevel) {
      return topLevelFeatures
    }
    return topLevelFeatures
      .map((topLevelFeature) => this.findIndexedId(id, topLevelFeature))
      .filter((feature): feature is Feature => feature !== undefined)
  }

  findIndexedId(id: string, feature: FeatureDocument): Feature | undefined {
    const { attributes } = feature.toObject({
      flattenMaps: true,
    })
    if (attributes) {
      for (const attributeValue of Object.values(attributes)) {
        if (attributeValue.includes(id)) {
          return feature
        }
      }
    }
    if (!feature.children) {
      return
    }
    for (const [, childFeature] of feature.children) {
      const subFeature = this.findIndexedId(id, childFeature as FeatureDocument)
      if (subFeature) {
        return subFeature
      }
    }
    return
  }

  async findByFeatureIds(
    featureIds: string[],
    topLevel?: boolean,
    user?: DecodedJWT,
  ) {
    const foundFeatures: Feature[] = []
    // all featureIds that have already been fetched
    const fetchedFeatureIds = new Set<string>()

    for (const featureId of featureIds) {
      if (fetchedFeatureIds.has(featureId)) {
        this.logger.debug(`FeatureId ${featureId} already fetched, skipping...`)
        continue
      }

      try {
        const feature = await this.findById(featureId, topLevel, user)
        foundFeatures.push(feature)
        for (const id of feature.allIds) {
          fetchedFeatureIds.add(id)
        }
      } catch (error) {
        this.logger.error(
          `Error occurred while fetching feature ${featureId}`,
          error instanceof Error ? error.stack : String(error),
        )
      }
    }
    return foundFeatures
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureId - featureId
   * @param topLevel - If true, return the top level feature and its children. If false, return the requested feature and its children.
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string, topLevel?: boolean, user?: DecodedJWT) {
    // Search correct feature
    const topLevelFeature = await this.featureModel
      .findOne({ allIds: featureId })
      .exec()

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    if (user) {
      const refSeqDoc = await this.refSeqModel
        .findById(topLevelFeature.refSeq)
        .exec()
      if (!refSeqDoc) {
        throw new NotFoundException(
          `RefSeq for feature '${featureId}' was not found`,
        )
      }
      await this.ensureCanViewAssembly(user, refSeqDoc.assembly.toString())
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getFeatureFromId(
      topLevelFeature,
      featureId,
      topLevel,
    )
    if (!foundFeature) {
      const errMsg = 'ERROR when searching feature by featureId'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    this.logger.debug(`Feature found: ${JSON.stringify(foundFeature)}`)
    return foundFeature
  }

  /**
   * Get single feature by featureId
   * @param featureOrDocument -
   * @param featureId -
   * @returns
   */
  getFeatureFromId(
    feature: Feature,
    featureId: string,
    topLevel?: boolean,
    parent?: Feature | null,
  ): Feature | null {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      this.logger.debug(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      if (topLevel && parent) {
        return parent
      }
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug(
      'FeatureId was not found on top level so lets make recursive call...',
    )
    for (const [, childFeature] of feature.children ?? new Map()) {
      const subFeature = this.getFeatureFromId(
        childFeature,
        featureId,
        topLevel,
        feature,
      )
      if (subFeature) {
        if (topLevel) {
          return feature
        }
        return subFeature
      }
    }
    return null
  }

  async findByRange(searchDto: FeatureRangeSearchDto, user?: DecodedJWT) {
    const refSeqDoc = await this.refSeqModel.findById(searchDto.refSeq).exec()
    if (!refSeqDoc) {
      throw new NotFoundException(
        `RefSeq with id '${searchDto.refSeq}' not found`,
      )
    }
    if (user) {
      await this.ensureCanViewAssembly(user, refSeqDoc.assembly.toString())
    }

    const featureDocs = await this.featureModel
      .find({
        refSeq: searchDto.refSeq,
        min: { $lte: searchDto.end },
        max: { $gte: searchDto.start },
        status: 0,
      })
      .exec()
    for (const featureDoc of featureDocs) {
      await this.checksService.checkFeature(featureDoc)
    }
    const checkResults = await this.checksService.findByRange(searchDto)
    return [featureDocs, checkResults]
  }

  async checkFeature(featureId: string, checkTimestamps = true) {
    const topLevelFeature = await this.featureModel.findById(featureId).exec()
    if (!topLevelFeature) {
      return
    }
    return this.checksService.checkFeature(topLevelFeature, checkTimestamps)
  }

  async searchFeatures(
    searchDto: { term: string; assemblies: string },
    user: DecodedJWT,
  ) {
    const { assemblies, term } = searchDto
    const requestedAssemblyIds = assemblies.split(',')
    const assemblyIds = await this.getAllowedAssemblyIds(
      user,
      requestedAssemblyIds,
    )
    if (!this.isAdmin(user) && assemblyIds.length === 0) {
      return []
    }
    const refSeqs = await this.refSeqModel
      .find({ assembly: assemblyIds })
      .select('_id')
      .exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    return this.featureModel
      .find({ $text: { $search: `"${term}"` }, refSeq: { $in: refSeqIds } })
      .exec()
  }
}
