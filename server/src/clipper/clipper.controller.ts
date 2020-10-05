import {
  Controller,
  Get,
  Res,
  HttpException,
  Query,
  OnApplicationShutdown,
} from '@nestjs/common';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { Response } from 'express';
import mkdirp from 'mkdirp';
import path from 'path';
import { Writable } from 'stream';
import { AppLogger } from '../logger/logger';
import { existsSync } from 'fs';

const evenify = n =>
  Math.round(n) % 2 === 0 ? Math.round(n) : Math.round(n) + 1;
const round = n => Math.round(n * 100) / 100;
@Controller('clipper')
export class ClipperController implements OnApplicationShutdown {
  private streams: Writable[] = [];

  constructor(private logger: AppLogger) {
    this.logger.setContext('ClipperController');
  }

  @Get('vid')
  public async getStream(@Query('url') url: string) {
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;
    try {
      const info = await ytdl.getInfo(vid, {
        quality: 'highest',
      });
      return {
        data: info.formats[0],
        bestVideo: info.formats.find(t => t.itag === 18),
      };
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }

  @Get('clip')
  public async clipStream(
    @Query('url') url: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('download') download: string,
    @Query('type') type: string,
    @Query('fps') fps = 30,
    @Query('scale') scale = 1,
    @Query('x') x = 0,
    @Query('y') y = 0,
    @Query('width') width = 1,
    @Query('height') height = 1,
    @Res() res: Response,
  ) {
    if (!url) throw new HttpException('Url is not supplied', 400);
    const vid = url;

    const dur = Number(end) - Number(start);
    if (isNaN(Number(end)) || isNaN(Number(start))) {
      return new HttpException('Invalid start/end time', 400);
    }

    if (dur > 600) {
      return new HttpException('Video clip too long', 400);
    }
    try {
      this.logger.verbose('[clipper] downloading info');
      const options = {
        quality: !type || type === 'gif' ? 18 : 'highest',
      };
      const info = await ytdl.getInfo(vid, options);
      const vidStream = ytdl(vid, options);
      this.logger.verbose('[clipper] downloaded info');
      // vidStream.on('progress', (_, downloaded, total) => {
      //   this.logger.verbose(
      //     `[ytdl] ${Math.round((downloaded * 100) / total)}% of ${total}`,
      //   );
      // });
      let resStream = ffmpeg(vidStream);
      // console.log(vid, Number(start ?? 0), end, dur);

      resStream = resStream.setDuration(dur);
      const filters = [];

      if (
        Number(x) >= 0 &&
        Number(y) >= 0 &&
        Number(width) > 0 &&
        Number(height) > 0
      ) {
        filters.push(
          `crop=${round(width)}*in_w:${round(height)}*in_h:${round(
            x,
          )}*in_w:${round(y)}*in_h`,
        );
      }

      filters.push(`scale=${scale}*in_w:-2`);
      resStream = resStream.videoFilters(filters);

      if (Number(start ?? 0) > 0)
        resStream = resStream.seekInput(Number(start ?? 0));

      let filename = `${info.videoDetails.title}_${start}_${end}`;

      switch (type) {
        case 'mp4':
          resStream = resStream
            .format('mp4')
            .outputOptions('-movflags frag_keyframe+empty_moov');
          res.setHeader('content-type', 'video/mp4');
          filename += '.mp4';
          break;
        case 'flv':
          resStream = resStream.format('flv');
          res.setHeader('content-type', 'video/flv');
          filename += '.flv';
          break;
        case 'mov':
          resStream = resStream.format('mov');
          res.setHeader('content-type', 'video/mov');
          filename += '.mov';
          break;
        case 'webp':
          resStream = resStream.format('webp');
          res.setHeader('content-type', 'video/webp');
          filename += '.webp';
          break;
        case 'mp3':
          resStream = resStream.format('mp3');
          res.setHeader('content-type', 'audio/mp3');
          filename += '.mp3';
          break;
        case 'wav':
          resStream = resStream.format('wav');
          res.setHeader('content-type', 'audio/wav');
          filename += '.wav';
          break;
        default:
          this.logger.verbose(
            `Saving temp file for ${info.videoDetails.title}`,
          );
          const tmpname = `tmp/tmp-${filename}-${scale}-${x}-${y}-${width}-${height}.mp4`;
          await mkdirp(path.join(__dirname, '../../../files/tmp'));
          if (!existsSync(path.join(__dirname, '../../../files', tmpname)))
            await new Promise((resolve, reject) =>
              resStream
                .saveToFile(path.join(__dirname, '../../../files', tmpname))
                .on('progress', progress => {
                  this.logger.verbose(`[download] ${JSON.stringify(progress)}`);
                })
                .on('end', () => {
                  this.logger.verbose(`[download] saved temp file`);
                  resolve();
                })
                .on('error', err => {
                  this.logger.debug(`[download] error: ${err.message}`);
                  reject();
                }),
            );

          this.logger.verbose(`Creating GIF for ${info.videoDetails.title}`);
          resStream = ffmpeg(path.join(__dirname, '../../../files', tmpname))
            .format('gif')
            .outputFPS(Number(fps))
            .videoFilter(
              `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
            );
          filename += '.gif';
          res.setHeader('content-type', 'image/gif');
          break;
      }

      if (download) {
        res.setHeader(
          'content-disposition',
          `attachment; filename=${encodeURIComponent(filename)}`,
        );
      } else {
        res.setHeader(
          'content-disposition',
          `inline; filename=${encodeURIComponent(filename)}`,
        );
      }

      // console.log(filename);
      this.streams.push(
        resStream
          .on('progress', progress => {
            this.logger.verbose(`[conversion] ${JSON.stringify(progress)}`);
          })
          .on('error', err => {
            this.logger.debug(`[conversion] error: ${err.message}`);
            vidStream.destroy();
            resStream.removeAllListeners();
          })
          .on('end', () => {
            this.logger.verbose('[conversion] finished');
          })
          .pipe(res),
      );
    } catch (error) {
      return new HttpException('Oops', 400);
    }
  }

  onApplicationShutdown() {
    this.streams.forEach(s => {
      s.destroy();
    });
    this.logger.debug('Cleared ' + this.streams.length + ' streams.');
    this.streams = [];
  }
}
