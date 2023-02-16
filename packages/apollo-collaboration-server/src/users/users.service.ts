import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { UserDocument, User as UserSchema } from 'apollo-schemas'
import { DecodedJWT, makeUserSessionId } from 'apollo-shared'
import { Model } from 'mongoose'
import { GUEST_USER_EMAIL, GUEST_USER_NAME } from 'src/utils/constants'

import {
  RequestUserInformationMessage,
  UserLocationMessage,
} from '../messages/entities/message.entity'
import { MessagesGateway } from '../messages/messages.gateway'
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
    private readonly configService: ConfigService<
      {
        BROADCAST_USER_LOCATION: boolean
        ALLOW_GUEST_USER: boolean
        GUEST_USER_ROLE: 'admin' | 'user' | 'readOnly'
      },
      true
    >,
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

  async bootstrapDB() {
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    const guestUserRole = this.configService.get('GUEST_USER_ROLE', {
      infer: true,
    })
    const guestUser = await this.findByEmail(GUEST_USER_EMAIL)
    if (allowGuestUser) {
      if (guestUser) {
        return
      }
      return this.addNew({
        email: GUEST_USER_EMAIL,
        username: GUEST_USER_NAME,
        role: [guestUserRole],
      })
    }
    if (!guestUser) {
      return
    }
    return this.userModel.findOneAndDelete({ email: GUEST_USER_EMAIL }).exec()
  }

  /**
   * If BROADCAST_USER_LOCATION -environment variable is set to true then broadcast user's location to 'USER_LOCATION' -channel
   * @param userLocation - user's location information
   * @param token - user's token, email will be decoded from the token
   */
  broadcastLocation(userLocation: UserLocationDto[], user: DecodedJWT) {
    const broadcast = this.configService.get('BROADCAST_USER_LOCATION', {
      infer: true,
    })
    const channel = 'USER_LOCATION'

    if (broadcast) {
      const { email, username: userName } = user
      const userSessionId = makeUserSessionId(user)
      const msg: UserLocationMessage = {
        locations: userLocation,
        channel,
        userName,
        userSessionId,
      }
      this.logger.debug(
        `Broadcasting user ${JSON.stringify(
          email,
        )} location to channel "${channel}", the message is "${JSON.stringify(
          msg,
        )}"`,
      )
      this.messagesGateway.create(channel, msg)
    }
  }

  /**
   * Request other users's current location after user has successfully logged in
   * @param token - user's token
   */
  requestUsersLocations(user: DecodedJWT) {
    const channel = 'REQUEST_INFORMATION'
    const userSessionId = makeUserSessionId(user)
    const { username: userName } = user
    const msg: RequestUserInformationMessage = {
      channel,
      userName,
      userSessionId,
      reqType: 'CURRENT_LOCATION',
    }
    this.logger.debug(
      `*** Broadcasting request to resend users's current locations. Channel "${channel}", the message is "${JSON.stringify(
        msg,
      )}"`,
    )
    this.messagesGateway.create(channel, msg)
  }
}
