import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { UserDocument, User as UserSchema } from 'apollo-schemas'
import { Model } from 'mongoose'

import { CreateUserDto } from './dto/create-user.dto'

export interface User {
  email: string
  username: string
  password: string
}

@Injectable()
export class UsersService {
  private readonly users: User[]

  constructor(
    @InjectModel(UserSchema.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string) {
    return this.userModel.findById(id).exec()
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).exec()
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec()
  }

  async findByRole(role: 'admin' | 'user' | 'readOnly') {
    return this.userModel.findOne({ role }).sort('createdAt').exec()
  }

  async findAll() {
    return this.userModel.find().exec()
  }

  async addNew(user: CreateUserDto) {
    return this.userModel.create(user)
  }

  async getCount() {
    return this.userModel.count().exec()
  }
}
