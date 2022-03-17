import { Test, TestingModule } from '@nestjs/testing';
import { FeaturesController } from './features.controller';

describe('FeaturesController', () => {
  let controller: FeaturesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeaturesController],
    }).compile();

    controller = module.get<FeaturesController>(FeaturesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
