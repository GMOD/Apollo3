import { Test, type TestingModule } from '@nestjs/testing'

import { AuthenticationService } from './authentication.service.js'
import { LoginPageController } from './login-page.controller.js'

describe('LoginPageController', () => {
  let controller: LoginPageController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginPageController],
      providers: [
        {
          provide: AuthenticationService,
          useValue: { getLoginTypes: () => [] },
        },
      ],
    }).compile()

    controller = module.get<LoginPageController>(LoginPageController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('renders login buttons for the configured login types', async () => {
    const html = await controller.loginPage({
      user: undefined,
    } as unknown as Parameters<typeof controller.loginPage>[0])
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('No login methods are configured')
  })

  it('defaults the redirect_uri to the absolute /login path', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginPageController],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            getLoginTypes: () => [
              { name: 'google', message: 'Sign in with Google' },
            ],
          },
        },
      ],
    }).compile()
    const controllerWithLoginType =
      module.get<LoginPageController>(LoginPageController)

    const html = await controllerWithLoginType.loginPage({
      user: undefined,
    } as unknown as Parameters<typeof controller.loginPage>[0])

    expect(html).toContain('redirect_uri=%2Flogin')
  })
})
