import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static/dist/serve-static.module';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClipperModule } from './clipper/clipper.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'),
      serveStaticOptions: {
        setHeaders: (res, path) => {  // this covers  1. and 2. situation but NOT the 3. one
          res.setHeader('Cross-Origin-Opener-Policy','same-origin');
          res.setHeader("Cross-Origin-Embedder-Policy",'require-corp')
        }
    }
    }),
    ClipperModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
