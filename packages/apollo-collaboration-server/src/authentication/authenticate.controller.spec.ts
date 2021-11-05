import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticateController } from './authenticate.controller';

describe('AuthenticateController', () => {
  let controller: AuthenticateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticateController],
    }).compile();

    controller = module.get<AuthenticateController>(AuthenticateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
