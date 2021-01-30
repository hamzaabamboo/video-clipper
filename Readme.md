# Dead Simple Video Clipper

Simple video clipper to trim/convert videos to multiple formats

It basically runs ffmpeg commands for you with an interface for you to configure parameters. 

Powered by [ffmpeg-wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), [Nestjs](https://github.com/nestjs/nest), React and TypeScript

Try me now ! : http://video-clipper.herokuapp.com/

![screenshot](samples/screenshot.png)

## Run locally

By using docker image
```
docker run -p 3000:3000 hamzaabamboo/video-clipper
```

## Features

- Choose YouTube video as source
- Choose local file as source
- Crop video
- Trim video
- Simple user interface (?)
- Export to multiple formats
  - Image: GIF
  - Video: MP4, FLV, WebP, mov
  - Audio: mp3, wav
- Instagram boomerang effect

## Limitations

- Cannot convert long videos duration (Takes too much time)
- Support up to 2 GB of local files
## Sample

GIF creation

![sample1](samples/sample1.gif)

Cropping

![sample3](samples/sample3.gif)

Boomerang Mode

![sample2](samples/sample2.gif)

## Contribute

Feel free to create issue for feature request or pull request for new features
## TODO

- [ ] server computation
- [x] make it work with local videos
- [x] better UI
- [x] more formats