import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { processMp4 } from "./lib/mp4trim";

export const ffmpeg = createFFmpeg({
  log: true,
});

const verbose = (e) => console.log(e);

const round = (n) => Math.round(n * 100) / 100;

// const VIDEO = ["webp", "mp4", "flv", "mov"];

// const AUDIO = ["mp3", "wav"];

// const IMAGE = ["gif"];

export type QualityLabel = number | "local";
export const MEDIA_TYPES = {
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
};
export const downloadVideo = async (
  url: string,
  title: string,
  quality: QualityLabel
): Promise<Uint8Array> => {
  if (!url) throw new Error("Url is not supplied");

  verbose("[clipper] downloading info");

  const filenameInternal = `${encodeURIComponent(title)}`;
  const tmpname = `tmp/tmp-${filenameInternal}_${quality}.mp4`;

  verbose("[clipper] downloaded info");
  try {
    console.log(ffmpeg.FS("stat", tmpname));
    verbose("[clipper] using preloaded video");
  } catch (e) {
    ffmpeg.FS(
      "writeFile",
      `${tmpname}`,
      await fetchFile("clipper/dlVid?url=" + url + "&quality=" + quality)
    );
  } finally {
    return ffmpeg.FS("readFile", tmpname);
  }
};

export const clipStream = async (
  file: File,
  title: string,
  start?: number,
  end?: number,
  type: keyof typeof MEDIA_TYPES = "gif",
  quality?: number | "local",
  filename?: string,
  fps = 30,
  scale = 1,
  x = 0,
  y = 0,
  width = 1,
  height = 1,
  onProgress: (proress: { message: string; ratio?: number }) => void = () => {}
): Promise<{ file: Blob; type: string; name: string }> => {
  const dur = Number(end) - Number(start);
  if (type === "gif" && dur > 60) {
    throw new Error("Duration too long");
  }
  if (isNaN(Number(end)) || isNaN(Number(start))) {
    throw new Error("Invalid start/end time");
  }

  try {
    verbose("[clipper] downloading info");

    const { extension, mimetype, type: outType } = MEDIA_TYPES[type];

    const filenameInternal = `${encodeURIComponent(title)}`;
    const tmpname = `tmp-${filenameInternal}_${quality}.mp4`;
    const outname = `out-${filenameInternal}_${quality}_${start}_${end}_${scale}_${fps}_${x}_${y}_${width}_${height}.${extension}`;

    try {
      if (type !== "gif") {
        ffmpeg.FS("stat", `tmp/${tmpname}`);
      }
      console.log(ffmpeg.FS("mkdir", "test"));
      console.log(ffmpeg.FS("stat", "test/"));
    } catch (e) {
      // ffmpeg.FS("writeFile", `tmp/${tmpname}`, file);
    }

    // let file: Uint8Array;
    try {
      onProgress({
        message: "Loading Video...",
      });
      ffmpeg.FS("stat", outname);
      onProgress({
        message: "Done...",
      });
    } catch {
      const args: string[] = [];
      if (Number(start ?? 0) > 0)
        args.push("-ss", Number(start ?? 0).toString());

      args.push("-i", `test/abc.mkv`);

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

      switch (type) {
        case "mp4":
          args.push("-c:v", "libx264");
          // args.push("-movflags", "frag_keyframe+empty_moov");
          break;
        case "gif":
          verbose(`Saving temp file for ${title}`);

          const gifName = `tmp/gif-${filenameInternal}_${quality}_${start}_${end}_${scale}_${fps}_${x}_${y}_${width}_${height}.mp4`;

          args.push("-c:v", "libx264");

          args.push(gifName);

          console.log(file.name);
          await processMp4(args, [file]);

          // ffmpeg.setProgress(({ ratio }) => {
          //   onProgress({
          //     message: `Saving Temporary Video File`,
          //     ratio: Math.round(ratio * 100),
          //   });
          // });
          // await ffmpeg.run(...args);
          // ffmpeg.setProgress(() => {});
          verbose(`Creating GIF for ${title}`);
          args.splice(0, args.length);
          args.push(
            "-i",
            gifName,
            "-vf",
            `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`
          );
          break;
      }

      args.push(outname);

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

      onProgress({
        message: "Done !",
      });
    }
    const fileRes = ffmpeg.FS("readFile", outname) as Uint8Array;

    return {
      file: new File(
        [fileRes],
        `${filename ?? filenameInternal}.${extension}`,
        {
          type: mimetype,
        }
      ),
      type: outType,
      name: `${filename ?? filenameInternal}.${extension}`,
    };
  } catch (error) {
    console.log(error);
    throw new Error("Oops");
  }
};
