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
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { type FilterQuery, Model } from 'mongoose'

import { MessagesGateway } from '../messages/messages.gateway.js'
import {
  GUEST_USER_EMAIL,
  GUEST_USER_NAME,
  ROOT_USER_EMAIL,
  ROOT_USER_NAME,
} from '../utils/constants.js'
import { Role } from '../utils/role/role.enum.js'

import { CreateUserDto, UserLocationDto } from './dto/create-user.dto.js'
import type { FindUsersDto } from './dto/find-users.dto.js'

export interface User {
  email: string
  username: string
  password: string
}

export type SpecialUserType = 'guest' | 'root'

const specialUserEmails = [GUEST_USER_EMAIL, ROOT_USER_EMAIL]

const sortableFields = new Set(['username', 'email', 'role', 'createdAt'])

function getSpecialUserType(email: string): SpecialUserType | undefined {
  if (email === GUEST_USER_EMAIL) {
    return 'guest'
  }
  if (email === ROOT_USER_EMAIL) {
    return 'root'
  }
  return undefined
}

/** Serialize a user document, tagging it if it is a guest or root user */
export function toUserResponse(user: UserDocument) {
  const special = getSpecialUserType(user.email)
  const json = user.toJSON()
  return special ? { ...json, special } : json
}

function escapeRegExp(str: string) {
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)
}

@Injectable()
export class UsersService implements OnApplicationBootstrap {
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
        ALLOW_ROOT_USER: boolean
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

  async findByRole(role: Role) {
    return this.userModel.findOne({ role }).sort('createdAt').exec()
  }

  async findGuest() {
    return this.findByEmail(GUEST_USER_EMAIL)
  }

  async findAll() {
    return this.userModel.find().exec()
  }

  /**
   * Find a page of regular (non-guest, non-root) users matching the given
   * search, sort, and filter options. Guest and root users are always
   * returned separately in `specialUsers`.
   */
  async findPage(findUsersDto: FindUsersDto) {
    const { page, pageSize, role, roleOperator, search, sortField, sortOrder } =
      findUsersDto
    const queryCond: FilterQuery<UserDocument> = {
      email: { $nin: specialUserEmails },
    }
    if (search) {
      const $regex = escapeRegExp(search)
      queryCond.$or = [
        { username: { $regex, $options: 'i' } },
        { email: { $regex, $options: 'i' } },
      ]
    }
    if (role) {
      const validRoles = new Set<string>(Object.values(Role))
      const roles: (string | null)[] = role
        .split(',')
        .filter((r) => validRoles.has(r))
      // Users with no role set are treated the same as role "none"
      if (roles.includes(Role.None)) {
        roles.push(null)
      }
      queryCond.role =
        roleOperator === 'notIn' ? { $nin: roles } : { $in: roles }
    }
    const resolvedSortField =
      sortField && sortableFields.has(sortField) ? sortField : 'username'
    const resolvedSortOrder = sortOrder === 'desc' ? -1 : 1
    const pageNum = Math.max(Number(page) || 0, 0)
    const size = Math.min(Math.max(Number(pageSize) || 25, 1), 1000)
    const [users, totalCount, specialUsers] = await Promise.all([
      this.userModel
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .find(queryCond)
        .sort({ [resolvedSortField]: resolvedSortOrder, _id: 1 })
        .skip(pageNum * size)
        .limit(size)
        .exec(),
      this.userModel.countDocuments(queryCond).exec(),
      this.userModel.find({ email: { $in: specialUserEmails } }).exec(),
    ])
    return {
      users: users.map((user) => toUserResponse(user)),
      totalCount,
      specialUsers: specialUsers.map((user) => toUserResponse(user)),
    }
  }

  async addNew(user: CreateUserDto) {
    return this.userModel.create(user)
  }

  async getCount() {
    return this.userModel.count().exec()
  }

  async onApplicationBootstrap() {
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    const guestUserRole = this.configService.get('GUEST_USER_ROLE', {
      infer: true,
    })
    const allowRootUser = this.configService.get('ALLOW_ROOT_USER', {
      infer: true,
    })
    await this.syncSpecialUser(allowGuestUser, {
      email: GUEST_USER_EMAIL,
      username: GUEST_USER_NAME,
      role: guestUserRole,
    })
    await this.syncSpecialUser(allowRootUser, {
      email: ROOT_USER_EMAIL,
      username: ROOT_USER_NAME,
      role: Role.Admin,
    })
  }

  /**
   * Ensure a special (guest or root) user exists in the database if it is
   * allowed, or is removed from the database if it is not
   */
  private async syncSpecialUser(allowed: boolean, user: CreateUserDto) {
    const existingUser = await this.findByEmail(user.email)
    if (allowed) {
      if (existingUser) {
        return
      }
      this.logger.log(`Adding user "${user.username}" (${user.email})`)
      await this.addNew(user)
      return
    }
    if (!existingUser) {
      return
    }
    this.logger.log(`Removing user "${user.username}" (${user.email})`)
    await this.userModel.findOneAndDelete({ email: user.email }).exec()
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
