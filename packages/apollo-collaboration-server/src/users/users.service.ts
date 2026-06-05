import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

import {
  User as UserSchema,
  type UserDocument,
} from '@apollo-annotation/schemas'
import {
  type DecodedJWT,
  type RequestUserInformationMessage,
  type UserLocationMessage,
  makeUserSessionId,
} from '@apollo-annotation/shared'
import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { MessagesGateway } from '../messages/messages.gateway.js'
import { GUEST_USER_EMAIL, GUEST_USER_NAME } from '../utils/constants.js'
import { Role } from '../utils/role/role.enum.js'

import {
  CreateLocalUserDto,
  CreateUserDto,
  UserLocationDto,
} from './dto/create-user.dto.js'

const scrypt = promisify(scryptCallback)

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
        GUEST_USER_ROLE: Role
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

  async findLocalByIdentifier(identifier: string) {
    return this.userModel
      .findOne({
        $or: [{ email: identifier }, { username: identifier }],
      })
      .select('+passwordHash')
      .exec()
  }

  async findByRole(role: Role) {
    return this.userModel.findOne({ role }).sort('createdAt').exec()
  }

  async findGuest() {
    return this.findByEmail(GUEST_USER_EMAIL)
  }

  async findAll() {
    return this.userModel.find().exec()
  }

  async addNew(user: CreateUserDto) {
    return this.userModel.create(user)
  }

  async createLocalUser(user: CreateLocalUserDto) {
    const existingEmail = await this.findByEmail(user.email)
    if (existingEmail) {
      throw new ConflictException(
        `User with email '${user.email}' already exists`,
      )
    }

    const existingUsername = await this.findByUsername(user.username)
    if (existingUsername) {
      throw new ConflictException(
        `User with username '${user.username}' already exists`,
      )
    }

    const passwordHash = await this.hashPassword(user.password)
    const createdUser = await this.userModel.create({
      email: user.email,
      username: user.username,
      role: user.role,
      passwordHash,
    })
    return {
      _id: createdUser._id,
      email: createdUser.email,
      username: createdUser.username,
      role: createdUser.role,
    }
  }

  async hashPassword(password: string) {
    const salt = randomBytes(16)
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer
    return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`
  }

  async verifyPassword(password: string, passwordHash?: string) {
    if (!passwordHash) {
      return false
    }
    const [algorithm, saltHex, hashHex] = passwordHash.split(':')
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
      return false
    }
    const derivedKey = (await scrypt(
      password,
      Buffer.from(saltHex, 'hex'),
      64,
    )) as Buffer
    return timingSafeEqual(derivedKey, Buffer.from(hashHex, 'hex'))
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
        role: guestUserRole,
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
  broadcastLocation(userLocations: UserLocationDto[], user: DecodedJWT) {
    const broadcast = this.configService.get('BROADCAST_USER_LOCATION', {
      infer: true,
    })
    const channel = 'USER_LOCATION'

    if (!broadcast) {
      return
    }
    const { email, username: userName } = user
    const userSessionId = makeUserSessionId(user)
    const msg: UserLocationMessage = {
      locations: userLocations.map((location) => ({
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...location,
        start: Number(location.start),
        end: Number(location.end),
      })),
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
    return this.messagesGateway.create(channel, msg)
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
    return this.messagesGateway.create(channel, msg)
  }
}
