import { Assembly, type AssemblyDocument } from '@apollo-annotation/schemas'
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { ChecksService } from '../checks/checks.service.js'
import { FeaturesService } from '../features/features.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'

import { CreateAssemblyDto } from './dto/create-assembly.dto.js'
import { UpdateAssemblyDto } from './dto/update-assembly.dto.js'

@Injectable()
export class AssembliesService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    private readonly checksService: ChecksService,
    private readonly featuresService: FeaturesService,
    private readonly refSeqsService: RefSeqsService,
  ) {}

  private readonly logger = new Logger(AssembliesService.name)

  private normalizeScientificName(scientificName?: string) {
    const normalized = scientificName?.trim()
    return normalized || undefined
  }

  async create(createAssemblyDto: CreateAssemblyDto) {
    const scientificName = this.normalizeScientificName(
      createAssemblyDto.scientificName,
    )
    return this.assemblyModel.create({
      ...createAssemblyDto,
      scientificName,
    })
  }

  async updateChecks(_id: string, checks: string[]) {
    try {
      await this.assemblyModel.updateOne(
        { $and: [{ _id, status: 0 }] },
        { $set: { checks } },
      )
    } catch (error) {
      this.logger.debug(
        '*** UPDATE STATUS EXCEPTION - Could not update checks in assembly document!',
      )
      throw new UnprocessableEntityException(String(error))
    }

    // Delete checks that are no longer registered
    const checkResults = await this.checksService.find({ assembly: _id })
    const obsoleteCheckIds = checkResults
      .filter((x) => !checks.includes(x.name))
      .map((x) => x._id)
    await this.checksService.deleteChecks(obsoleteCheckIds)

    // Get features in assembly and apply the new checks
    const refSeqs = await this.refSeqsService.findAll({ assembly: _id })
    for (const refSeq of refSeqs) {
      const features = await this.featuresService.findByRange({
        refSeq: refSeq._id.toString(),
        start: 0,
        end: refSeq.length,
      })
      for (const feature of features) {
        for (const f of feature) {
          await this.featuresService.checkFeature(f._id.toString(), false)
        }
      }
    }
  }

  findAll() {
    return this.assemblyModel.find({ status: 0 }).exec()
  }

  async findOne(id: string) {
    const assembly = await this.assemblyModel
      .findOne({ _id: id, status: 0 })
      .exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${id}" not found`)
    }
    return assembly
  }

  update(id: string, updateAssemblyDto: UpdateAssemblyDto) {
    const normalizedUpdateDto: Record<string, unknown> = {
      ...updateAssemblyDto,
    }
    if ('scientificName' in updateAssemblyDto) {
      normalizedUpdateDto.scientificName = this.normalizeScientificName(
        updateAssemblyDto.scientificName,
      )
    }

    return this.assemblyModel
      .findOneAndUpdate(
        { _id: id, status: 0 },
        { $set: normalizedUpdateDto },
        {
          runValidators: true,
          new: true,
        },
      )
      .exec()
  }

  remove(id: string) {
    return this.assemblyModel.findByIdAndDelete(id).exec()
  }
}
