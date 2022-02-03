import { Test, TestingModule } from '@nestjs/testing';
import { ChangeController } from './change.controller';

describe('ChangeController', () => {
  let controller: ChangeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeController],
    }).compile();

    controller = module.get<ChangeController>(ChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
