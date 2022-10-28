import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class AzureADGuard extends AuthGuard('azure-ad') {}
