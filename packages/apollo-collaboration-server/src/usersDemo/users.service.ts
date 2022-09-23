import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { User, UserDocument } from 'apollo-schemas'
import { Model } from 'mongoose'
// import { userInfo } from 'os'

export interface DemoUser {
  userId: number
  username: string
  password: string
}

/**
 * DEMO PURPOSE ONLY - TEST DUMMY AUTHENTICATION
 */
@Injectable()
export class UsersService {
  private readonly users: DemoUser[]

  constructor(
    @InjectModel(User.name)
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

  async findOne(username: string): Promise<DemoUser | undefined> {
    return this.users.find((user) => user.username === username)
  }

  findAll() {
    return this.userModel.find().exec()
  }
}
