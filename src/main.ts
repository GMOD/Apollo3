import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Define in application level what you want to log
    logger: ['log', 'error', 'warn', 'debug'],
    //logger: ['log', 'error', 'warn'],
    //logger: ['error', 'warn'],
  });
  //const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
