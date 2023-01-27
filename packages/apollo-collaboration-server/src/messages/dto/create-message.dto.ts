export class CreateMessageDto {}

export class RequestUserInformationDto {
  readonly channel: string
  readonly userToken: string
  readonly reqType: string
}
