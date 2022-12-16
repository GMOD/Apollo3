import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Assembly, AssemblyDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { CreateAssemblyDto } from './dto/create-assembly.dto'
import { UpdateAssemblyDto } from './dto/update-assembly.dto'

@Injectable()
export class AssembliesService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
  ) {}

  private readonly logger = new Logger(AssembliesService.name)

  create(createAssemblyDto: CreateAssemblyDto) {
    return this.assemblyModel.create(createAssemblyDto)
  }

  findAll() {
    return this.assemblyModel.find({status: 0}).exec()
  }

  async findOne(id: string) {
    const assembly = await this.assemblyModel.findById({id, status: 0}).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${id}" not found`)
    }
    return assembly
  }

  update(id: string, updateAssemblyDto: UpdateAssemblyDto) {
    return this.assemblyModel
      .findByIdAndUpdate({id, status: 0}, updateAssemblyDto, { runValidators: true })
      .exec()
  }

  remove(id: string) {
    return this.assemblyModel.findByIdAndDelete(id).exec()
  }
}
