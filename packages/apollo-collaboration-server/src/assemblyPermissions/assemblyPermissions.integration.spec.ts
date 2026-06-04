import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { jest } from '@jest/globals'
import request from 'supertest'

import { AssemblyPermissionsController } from './assemblyPermissions.controller.js'
import { AssemblyPermissionsService } from './assemblyPermissions.service.js'

describe('AssemblyPermissionsController (integration)', () => {
  let app: INestApplication

  const serviceMock = {
    find: jest.fn().mockResolvedValue([]),
    findByUser: jest.fn().mockResolvedValue([]),
    findByAssembly: jest.fn().mockResolvedValue([]),
    upsertPermission: jest.fn().mockResolvedValue({
      userId: 'user1',
      assemblyId: 'assembly1',
      canViewAnnotations: true,
      canEditAnnotations: true,
    }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AssemblyPermissionsController],
      providers: [
        {
          provide: AssemblyPermissionsService,
          useValue: serviceMock,
        },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use((req, _res, next) => {
      req.user = {
        username: 'admin',
        email: 'admin@test',
      }
      next()
    })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /assemblyPermissions forwards query filters', async () => {
    await request(app.getHttpServer())
      .get('/assemblyPermissions')
      .query({ userId: 'u1', assemblyId: 'a1' })
      .expect(200)

    expect(serviceMock.find).toHaveBeenCalledWith('u1', 'a1')
  })

  it('GET /assemblyPermissions/byUser/:userId forwards user id', async () => {
    await request(app.getHttpServer())
      .get('/assemblyPermissions/byUser/u1')
      .expect(200)

    expect(serviceMock.findByUser).toHaveBeenCalledWith('u1')
  })

  it('GET /assemblyPermissions/byAssembly/:assemblyId forwards assembly id', async () => {
    await request(app.getHttpServer())
      .get('/assemblyPermissions/byAssembly/a1')
      .expect(200)

    expect(serviceMock.findByAssembly).toHaveBeenCalledWith('a1')
  })

  it('PUT /assemblyPermissions/:userId/:assemblyId includes actor from req.user', async () => {
    await request(app.getHttpServer())
      .put('/assemblyPermissions/u1/a1')
      .send({ canViewAnnotations: false, canEditAnnotations: true })
      .expect(200)

    expect(serviceMock.upsertPermission).toHaveBeenCalledWith(
      'u1',
      'a1',
      {
        canViewAnnotations: false,
        canEditAnnotations: true,
      },
      'admin@test',
    )
  })
})
