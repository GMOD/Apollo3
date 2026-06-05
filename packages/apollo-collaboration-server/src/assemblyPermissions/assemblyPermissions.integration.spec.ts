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
    findEffectiveByUser: jest.fn().mockResolvedValue([]),
    findByAssembly: jest.fn().mockResolvedValue([]),
    upsertPermission: jest.fn().mockResolvedValue({
      userId: 'user1',
      assemblyId: 'assembly1',
      canViewAnnotations: true,
      canEditAnnotations: true,
    }),
    findGroups: jest.fn().mockResolvedValue([]),
    createGroup: jest.fn().mockResolvedValue({ _id: 'group1', name: 'group1' }),
    deleteGroup: jest.fn().mockResolvedValue({ deleted: true }),
    findGroupMembershipsByUser: jest.fn().mockResolvedValue([]),
    findGroupMembershipsByGroup: jest.fn().mockResolvedValue([]),
    setGroupMembership: jest
      .fn()
      .mockResolvedValue({ groupId: 'group1', userId: 'u1', isMember: true }),
    findGroupPermissions: jest.fn().mockResolvedValue([]),
    upsertGroupPermission: jest.fn().mockResolvedValue({
      groupId: 'group1',
      assemblyId: 'a1',
      canViewAnnotations: true,
      canEditAnnotations: false,
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

  it('GET /assemblyPermissions/groups forwards to service', async () => {
    await request(app.getHttpServer())
      .get('/assemblyPermissions/groups')
      .expect(200)

    expect(serviceMock.findGroups).toHaveBeenCalled()
  })

  it('PUT /assemblyPermissions/groups/memberships/:groupId/:userId forwards body and actor', async () => {
    await request(app.getHttpServer())
      .put('/assemblyPermissions/groups/memberships/group1/u1')
      .send({ isMember: true })
      .expect(200)

    expect(serviceMock.setGroupMembership).toHaveBeenCalledWith(
      'group1',
      'u1',
      true,
      'admin@test',
    )
  })
})
