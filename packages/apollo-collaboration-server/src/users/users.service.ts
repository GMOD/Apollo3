import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { UserDocument, User as UserSchema } from 'apollo-schemas'
import { Model } from 'mongoose'

export interface User {
  userId: number
  username: string
  password: string
}

@Injectable()
export class UsersService {
  private readonly users: User[]

  constructor(
    @InjectModel(UserSchema.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    this.users = [
      {
        userId: 1,
        username: 'john',
        password: 'changeme',
      },
      {
        userId: 2,
        username: 'chris',
        password: 'secret',
      },
      {
        userId: 3,
        username: 'maria',
        password: 'guess',
      },
      {
        userId: 4,
        username: 'demo',
        password: 'demo',
      },
    ]
  }

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username)
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec()
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).exec()
  }

  findAll() {
    return this.userModel.find().exec()
  }
}
