import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { UserDocument, User as UserSchema } from 'apollo-schemas'
import { Model } from 'mongoose'

import { UserLocationMessage } from '../messages/entities/message.entity'
import { MessagesGateway } from '../messages/messages.gateway'
import { getDecodedAccessToken } from '../utils/commonUtilities'
import { CreateUserDto, UserLocationDto } from './dto/create-user.dto'

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
    private readonly messagesGateway: MessagesGateway,
  ) {}

  private readonly logger = new Logger(UsersService.name)

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

  /**
   * If BROADCAST_USER_LOCATION -environment variable is set to true then broadcast user's location to 'USER_LOCATION' -channel
   * @param userLocation - user's location information
   * @param token - user's token, email will be decoded from the token
   */
  broadcastLocation(userLocation: UserLocationDto, token: string) {
    const { BROADCAST_USER_LOCATION } = process.env
    const channel = 'USER_LOCATION'

    if (!BROADCAST_USER_LOCATION) {
      throw new Error('No BROADCAST_USER_LOCATION found in .env file')
    }
    const broadcast: boolean = JSON.parse(BROADCAST_USER_LOCATION)
    if (broadcast) {
      const jwtPayload = getDecodedAccessToken(token)
      const { email: user } = jwtPayload
      const msg: UserLocationMessage = {
        ...userLocation,
        channel,
        userName: user,
        userToken: token,
      }

      // const msg: UserLocationMessage = {
      //   channel,
      //   assemblyId: userLocation.assemblyId,
      //   refSeq: userLocation.refSeq,
      //   featureId: userLocation.featureId,
      //   start: userLocation.start,
      //   end: userLocation.end,
      //   userName: user,
      //   userToken: token,
      // }
      this.logger.debug(
        `Broadcasting user ${JSON.stringify(
          user,
        )} location to channel '${channel}', changeObject: "${JSON.stringify(
          UserLocationMessage,
        )}"`,
      )
      this.messagesGateway.create(channel, msg)
    }
  }
}
