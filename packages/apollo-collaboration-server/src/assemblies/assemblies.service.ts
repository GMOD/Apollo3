import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Assembly, AssemblyDocument } from 'apollo-schemas'
import { GetAssembliesOperation } from 'apollo-shared'
import { Model } from 'mongoose'

import { OperationsService } from '../operations/operations.service'
import { CreateAssemblyDto } from './dto/create-assembly.dto'
import { UpdateAssemblyDto } from './dto/update-assembly.dto'

@Injectable()
export class AssembliesService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    private readonly operationsService: OperationsService,
  ) {}

  private readonly logger = new Logger(AssembliesService.name)

  create(createAssemblyDto: CreateAssemblyDto) {
    return this.assemblyModel.create(createAssemblyDto)
  }

  async findAll() {
    return this.operationsService.executeOperation<GetAssembliesOperation>({
      typeName: 'GetAssembliesOperation',
    })
  }

  async findOne(id: string) {
    const assembly = await this.assemblyModel.findById({ id, status: 0 }).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${id}" not found`)
    }
    return assembly
  }

  update(id: string, updateAssemblyDto: UpdateAssemblyDto) {
    return this.assemblyModel
      .findByIdAndUpdate({ id, status: 0 }, updateAssemblyDto, {
        runValidators: true,
      })
      .exec()
  }

  remove(id: string) {
    return this.assemblyModel.findByIdAndDelete(id).exec()
  }
}
