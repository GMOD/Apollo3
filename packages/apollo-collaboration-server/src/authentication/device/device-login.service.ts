import { createHash, randomBytes, randomInt } from 'node:crypto'

import {
  DEVICE_LOGIN_EXPIRES_IN_SECONDS,
  DeviceLogin,
  type DeviceLoginDocument,
} from '@apollo-annotation/schemas'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { AuthenticationService } from '../authentication.service.js'

interface ConfigValues {
  URL: string
}

/** Seconds the device should wait between polls for the token */
export const DEVICE_LOGIN_POLL_INTERVAL = 5

// No vowels (to avoid spelling words) or easily confused characters
const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'
const USER_CODE_LENGTH = 8

export type DeviceLoginPollResult =
  | { token: string }
  | { error: 'authorization_pending' | 'slow_down' | 'expired_token' }

function hashDeviceCode(deviceCode: string) {
  return createHash('sha256').update(deviceCode).digest('hex')
}

/** Normalize a user-entered code, e.g. "bcdf-ghjk" to "BCDFGHJK" */
export function normalizeUserCode(userCode: string) {
  return userCode.toUpperCase().replaceAll(/[^A-Z]/g, '')
}

/** Format a normalized user code for display, e.g. "BCDF-GHJK" */
export function formatUserCode(userCode: string) {
  const half = userCode.length / 2
  return `${userCode.slice(0, half)}-${userCode.slice(half)}`
}

function generateUserCode() {
  let code = ''
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += USER_CODE_ALPHABET.charAt(randomInt(USER_CODE_ALPHABET.length))
  }
  return code
}

/**
 * Logins started on a device that can't complete a browser login itself, such
 * as the CLI running on a remote server. Modeled on the OAuth 2.0 device
 * authorization grant (RFC 8628): the device gets a URL and a short code to
 * show the user, the user confirms the code and logs in using a browser
 * anywhere, and the device polls for the resulting token.
 */
@Injectable()
export class DeviceLoginService {
  private readonly logger = new Logger(DeviceLoginService.name)
  private readonly baseURL: string

  constructor(
    @InjectModel(DeviceLogin.name)
    private readonly deviceLoginModel: Model<DeviceLoginDocument>,
    private readonly authService: AuthenticationService,
    private readonly jwtService: JwtService,
    configService: ConfigService<ConfigValues, true>,
  ) {
    this.baseURL = configService.get('URL', { infer: true })
  }

  /** URL of a device login route, e.g. getURL('complete') */
  getURL(path?: string) {
    const url = new URL(this.baseURL)
    url.pathname = `${url.pathname}${url.pathname.endsWith('/') ? '' : '/'}auth/device${
      path ? `/${path}` : ''
    }`
    return url
  }

  private isExpired(deviceLogin: DeviceLogin) {
    return (
      Date.now() - deviceLogin.createdAt.getTime() >
      DEVICE_LOGIN_EXPIRES_IN_SECONDS * 1000
    )
  }

  async create(type: string) {
    const loginType = this.authService
      .getLoginTypes()
      .find((loginType) => loginType.name === type)
    if (!loginType) {
      throw new BadRequestException(`Unknown login type "${type}"`)
    }
    if (!loginType.needsPopup) {
      throw new BadRequestException(
        `Login type "${type}" doesn't need a browser, log in with it directly`,
      )
    }
    const deviceCode = randomBytes(32).toString('base64url')
    let userCode = generateUserCode()
    // Retry in the unlikely event of a collision with a login in progress
    for (let attempt = 0; ; attempt++) {
      try {
        await this.deviceLoginModel.create({
          deviceCodeHash: hashDeviceCode(deviceCode),
          userCode,
          type,
        })
        break
      } catch (error) {
        const isDuplicate =
          error instanceof Error && 'code' in error && error.code === 11_000
        if (!isDuplicate || attempt >= 4) {
          throw error
        }
        userCode = generateUserCode()
      }
    }
    const verificationURL = this.getURL()
    const verificationURLComplete = this.getURL()
    verificationURLComplete.searchParams.set(
      'user_code',
      formatUserCode(userCode),
    )
    this.logger.debug(`Started device login with "${type}"`)
    return {
      device_code: deviceCode,
      user_code: formatUserCode(userCode),
      verification_uri: verificationURL.href,
      verification_uri_complete: verificationURLComplete.href,
      expires_in: DEVICE_LOGIN_EXPIRES_IN_SECONDS,
      interval: DEVICE_LOGIN_POLL_INTERVAL,
    }
  }

  /** Find a device login that is waiting for the user to log in */
  async findPending(userCode: string) {
    const deviceLogin = await this.deviceLoginModel
      .findOne({ userCode: normalizeUserCode(userCode), status: 'pending' })
      .exec()
    if (!deviceLogin || this.isExpired(deviceLogin)) {
      return
    }
    return deviceLogin
  }

  /** Give the token from the user's browser login to the waiting device */
  async approve(userCode: string, token: string) {
    try {
      await this.jwtService.verifyAsync(token)
    } catch {
      return false
    }
    const deviceLogin = await this.findPending(userCode)
    if (!deviceLogin) {
      return false
    }
    deviceLogin.status = 'approved'
    deviceLogin.token = token
    await deviceLogin.save()
    return true
  }

  /** Called repeatedly by the device until the user has logged in */
  async poll(deviceCode: string): Promise<DeviceLoginPollResult> {
    const deviceLogin = await this.deviceLoginModel
      .findOne({ deviceCodeHash: hashDeviceCode(deviceCode) })
      .exec()
    if (!deviceLogin || this.isExpired(deviceLogin)) {
      return { error: 'expired_token' }
    }
    if (deviceLogin.status === 'approved' && deviceLogin.token) {
      // The token can only be retrieved once
      await deviceLogin.deleteOne()
      return { token: deviceLogin.token }
    }
    const { lastPolledAt } = deviceLogin
    deviceLogin.lastPolledAt = new Date()
    await deviceLogin.save()
    // Allow a little leeway for network delays
    if (
      lastPolledAt &&
      Date.now() - lastPolledAt.getTime() < DEVICE_LOGIN_POLL_INTERVAL * 800
    ) {
      return { error: 'slow_down' }
    }
    return { error: 'authorization_pending' }
  }
}
