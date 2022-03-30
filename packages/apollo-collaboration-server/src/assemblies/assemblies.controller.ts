import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common'

import { AssembliesService } from './assemblies.service'
import { CreateAssemblyDto } from './dto/create-assembly.dto'
import { UpdateAssemblyDto } from './dto/update-assembly.dto'

@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}
  private readonly logger = new Logger(AssembliesController.name)

  @Post()
  create(@Body() createAssemblyDto: CreateAssemblyDto) {
    return this.assembliesService.create(createAssemblyDto)
  }

  @Get()
  findAll() {
    return this.assembliesService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAssemblyDto: UpdateAssemblyDto,
  ) {
    return this.assembliesService.update(id, updateAssemblyDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assembliesService.remove(id)
  }
}
