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
import urlLib from 'url';
import https from 'https';
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
        bestVideo: info.formats.find((t) => t.itag === 18),
        allFormats: info.formats,
      };
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }

  @Get('dlVid')
  public async proxyDownload(
    @Query('url') url: string,
    @Query('quality') quality: string,
    @Res() res: Response,
  ) {
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;
    try {
      const info = await ytdl.getInfo(vid, {
        requestOptions: {
          quality: quality,
        },
      });
      ytdl.downloadFromInfo(info, { quality: quality }).pipe(res);
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }

  @Get('size')
  public async getSize(
    @Query('url') url: string,
    @Query('quality') quality: string,
    @Res() res: Response,
  ) {
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;
    try {
      const info = await ytdl.getInfo(vid, {
        requestOptions: {
          quality: quality,
        },
      });
      const stream = ytdl.downloadFromInfo(info, { quality: quality });
      stream.on('info', (info, format) => {
        var parsed = new URL(format.url);
        https
          .request(
            parsed,
            {
              method: 'HEAD',
            },
            (_res) => {
              res.send({ size: _res.headers['content-length'] });
            },
          )
          .end();
        stream.destroy();
      });
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }
}
