import {
  Controller,
  Get,
  Res,
  HttpException,
  Query,
  OnApplicationShutdown,
} from '@nestjs/common';
import ytdl from 'ytdl-core';
import { Response } from 'express';
import rimraf from 'rimraf';
import path from 'path';
import { AppLogger } from '../logger/logger';

@Controller('clipper')
export class ClipperController {
  constructor(private logger: AppLogger) {
    this.logger.setContext('ClipperController');
    rimraf.sync(path.join(__dirname, '../../files/tmp'));
  }
  @Get('ping')
  public async ping() {
    return 'pong';
  }

  @Get('vid')
  public async getStream(@Query('url') url: string) {
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;
    try {
      const info = await ytdl.getInfo(vid, {
        requestOptions: {
          quality: 'highest',
        },
      });
      return {
        data: info.formats[0],
        title: info.videoDetails.title,
        bestVideo: info.formats.find(t => t.itag === 18),
      };
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }

  @Get('dlVid')
  public async proxyDownload(
    @Query('url') url: string,
    @Res() res: Response,
  ) { 
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;
    try {
     await ytdl.getInfo(vid, {
        requestOptions: {
          quality: 'highest',
        },
      });
      ytdl(url).pipe(res);
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }
}
