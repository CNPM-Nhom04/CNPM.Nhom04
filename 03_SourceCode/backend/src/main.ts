import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle("Hệ thống Quản lý Chương trình Đào tạo")
    .setDescription("API cho dự án CTĐT - Nhóm 4")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(Number(process.env.PORT || 3002));
}
bootstrap();
