export class RootLoginDto {
  /** The root user's password, set with ROOT_USER_PASSWORD */
  password: string
}

export class StartDeviceLoginDto {
  /** Login type to use, one of the names from `GET /auth/types` */
  type?: string
}

export class DeviceLoginTokenDto {
  /** The `device_code` from `POST /auth/device` */
  device_code?: string
}

export class ConfirmDeviceLoginDto {
  /** The code shown on the device */
  user_code?: string
  /** CSRF token from the confirmation page */
  csrf?: string
}

export class TokenResponse {
  /** JWT to send in the `Authorization: Bearer` header */
  token: string
}

export class DeviceLoginStartResponse {
  /** Secret code to poll `POST /auth/device/token` with */
  device_code: string
  /** Code for the user to confirm, e.g. `BCDF-GHJK` */
  user_code: string
  /** Page where the user enters the code and logs in */
  verification_uri: string
  /** `verification_uri` with the code already filled in */
  verification_uri_complete: string
  /** Seconds until the login expires */
  expires_in: number
  /** Seconds to wait between polls */
  interval: number
}
