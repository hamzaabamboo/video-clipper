import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

export const ffmpeg = createFFmpeg({
  log: true,
});

const verbose = (e) => console.log(e);

const round = (n) => Math.round(n * 100) / 100;

// const VIDEO = ["webp", "mp4", "flv", "mov"];

// const AUDIO = ["mp3", "wav"];

// const IMAGE = ["gif"];

export const downloadVideo = async (
  url: string,
  title: string
): Promise<Uint8Array> => {
  if (!url) throw new Error("Url is not supplied");

  verbose("[clipper] downloading info");

  const filenameInternal = `${encodeURIComponent(title)}`;
  const tmpname = `tmp/tmp-${filenameInternal}.mp4`;

  verbose("[clipper] downloaded info");
  try {
    console.log(ffmpeg.FS("stat", tmpname));
    verbose("[clipper] using preloaded video");
  } catch (e) {
    ffmpeg.FS(
      "writeFile",
      `${tmpname}`,
      await fetchFile("clipper/dlVid?url=" + url)
    );
  } finally {
    return ffmpeg.FS("readFile", tmpname);
  }
};

export const clipStream = async (
  buffer: Uint8Array,
  title: string,
  start?: number,
  end?: number,
  type = "gif",
  filename?: string,
  fps = 30,
  scale = 1,
  x = 0,
  y = 0,
  width = 1,
  height = 1,
  onProgress: (proress: { message: string; ratio?: number }) => void = () => {}
): Promise<Blob> => {
  const dur = Number(end) - Number(start);
  if (isNaN(Number(end)) || isNaN(Number(start))) {
    throw new Error("Invalid start/end time");
  }

  try {
    verbose("[clipper] downloading info");

    const filenameInternal = `${encodeURIComponent(title)}`;
    const tmpname = `tmp/tmp-${filenameInternal}.mp4`;

    try {
      ffmpeg.FS("stat", `${tmpname}`);
    } catch (e) {
      ffmpeg.FS("writeFile", `${tmpname}`, buffer);
    }

    const args: string[] = [];
    if (Number(start ?? 0) > 0) args.push("-ss", Number(start ?? 0).toString());

    args.push("-i", `${tmpname}`);

    args.push("-t", dur.toString());

    if (type !== "mp3") {
      const filters: string[] = [];
      if (
        Number(x) >= 0 &&
        Number(y) >= 0 &&
        Number(width) > 0 &&
        Number(height) > 0
      ) {
        filters.push(
          `crop=${round(width)}*in_w:${round(height)}*in_h:${round(
            x
          )}*in_w:${round(y)}*in_h`
        );
      }

      filters.push(`scale=${scale}*in_w:-2`);
      args.push("-vf", filters.join(","));
    }

    let extension: string;
    let mimetype: string;
    switch (type) {
      case "mp4":
        extension = "video/mp4";
        mimetype = "mp4";
        args.push("-movflags", "frag_keyframe+empty_moov");
        break;
      case "flv":
        extension = "flv";
        mimetype = "video/flv";
        break;
      case "mov":
        extension = "mov";
        mimetype = "video/mov";
        break;
      case "webp":
        extension = "webp";
        mimetype = "image/webp";
        break;
      case "mp3":
        extension = "mp3";
        mimetype = "audio/mp3";
        break;
      case "wav":
        extension = "wav";
        mimetype = "audio/wav";
        break;
      default:
        verbose(`Saving temp file for ${title}`);
        args.push(`tmp/gif-${filenameInternal}.mp4`);

        ffmpeg.setProgress(({ ratio }) => {
          onProgress({
            message: `Saving Temporary Video File`,
            ratio: Math.round(ratio * 100),
          });
        });
        await ffmpeg.run(...args);
        ffmpeg.setProgress(() => {});

        verbose(`Creating GIF for ${title}`);
        args.splice(0, args.length);
        args.push(
          "-i",
          `tmp/gif-${filenameInternal}.mp4`,
          "-vf",
          `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`
        );
        extension = "gif";
        mimetype = "image/gif";
        break;
    }
    args.push(`out-${filenameInternal}.${extension}`);

    ffmpeg.setProgress(({ ratio }) => {
      onProgress({
        message: "Converting...",
        ratio: Math.round(ratio * 100),
      });
    });
    await ffmpeg.run(...args);
    ffmpeg.setProgress(() => {});

    onProgress({
      message: "Saving Video...",
    });

    const file = ffmpeg.FS(
      "readFile",
      `out-${filenameInternal}.${extension}`
    ) as Uint8Array;

    onProgress({
      message: "Done !",
    });

    return new File([file], `${filename ?? filenameInternal}.${extension}`, {
      type: mimetype,
    });
  } catch (error) {
    console.log(error);
    throw new Error("Oops");
  }
};
