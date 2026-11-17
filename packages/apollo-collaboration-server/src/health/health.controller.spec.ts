import { ServiceUnavailableException } from '@nestjs/common'
import {
  HealthIndicatorService,
  MongooseHealthIndicator,
  TerminusModule,
} from '@nestjs/terminus'
import { Test, type TestingModule } from '@nestjs/testing'

import { MessagesService } from '../messages/messages.service.js'

import { HealthController } from './health.controller.js'

describe('HealthController', () => {
  let controller: HealthController
  let mongodbUp: boolean
  let tailing: boolean

  beforeEach(async () => {
    mongodbUp = true
    tailing = true
    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false })],
      controllers: [HealthController],
      providers: [
        {
          provide: MongooseHealthIndicator,
          inject: [HealthIndicatorService],
          useFactory: (healthIndicatorService: HealthIndicatorService) => ({
            pingCheck: (key: string) => {
              const indicator = healthIndicatorService.check(key)
              return mongodbUp ? indicator.up() : indicator.down()
            },
          }),
        },
        { provide: MessagesService, useValue: { isTailing: () => tailing } },
      ],
    }).compile()

    controller = module.get<HealthController>(HealthController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should report the package version', () => {
    expect(controller.getVersion().version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('is healthy when MongoDB is up and server events are flowing', async () => {
    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      info: { mongodb: { status: 'up' }, serverEvents: { status: 'up' } },
    })
  })

  it('is unhealthy when MongoDB is down', async () => {
    mongodbUp = false
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('is unhealthy when server events are not flowing', async () => {
    tailing = false
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('is live even when MongoDB is down', async () => {
    mongodbUp = false
    tailing = false
    await expect(controller.live()).resolves.toMatchObject({ status: 'ok' })
  })
})
