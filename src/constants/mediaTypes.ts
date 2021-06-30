export const MEDIA_TYPES: Record<
  string,
  {
    type: string;
    extension: string;
    convertExtension?: string;
    mimetype: string;
  }
> = {
  mp4: {
    type: "video",
    extension: "mp4",
    mimetype: "video/mp4",
  },
  webp: {
    type: "video",
    extension: "webp",
    mimetype: "video/webp",
  },
  flv: {
    type: "video",
    extension: "flv",
    mimetype: "video/flv",
  },
  mov: {
    type: "video",
    extension: "mov",
    mimetype: "video/mov",
  },
  mp3: {
    type: "audio",
    extension: "mp3",
    mimetype: "audio/mp3",
  },
  wav: {
    type: "audio",
    extension: "wav",
    mimetype: "audio/wav",
  },
  gif: {
    type: "image",
    extension: "gif",
    mimetype: "image/gif",
  },
  png: {
    type: "image",
    extension: "png",
    mimetype: "image/png",
  },
  jpg: {
    type: "image",
    extension: "jpg",
    mimetype: "image/jpg",
  },
  apng: {
    type: "image",
    convertExtension: "apng",
    extension: "png",
    mimetype: "image/apng",
  },
};
