import { createFFmpeg } from "@ffmpeg/ffmpeg";
import { ClippingOptions, Duration } from "src/types/clipping";
import { MEDIA_TYPES } from "../constants/mediaTypes";

export const ffmpeg = createFFmpeg({
  corePath: "./ffmpeg-core.js",
  log: true,
  progress: () => {},
});

export const verbose = (e: string) => console.log(e);

const round = (n: number) => Math.round(n * 100) / 100;

export type QualityLabel = number | "local";

export const clipStream = async (
  buffer: Uint8Array,
  title: string,
  duration: Duration,
  type: keyof typeof MEDIA_TYPES,
  quality?: number | "local",
  options: ClippingOptions = {
    fps: 30,
    scale: 1,
    crop: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    speed: 1,
    flags: {
      boomerang: false,
    },
  },
  onProgress: (proress: { message: string; ratio?: number }) => void = () => {}
): Promise<{ file: Blob; type: string; name: string }> => {
  const { fps, scale, crop, speed, flags, filename } = options;
  const { start, end } = duration;
  const { x, y, width, height } = crop;
  const { boomerang } = flags;

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
    const tmpname = `tmp/tmp-${filenameInternal}_${quality}.mp4`;
    const outname =
      type !== "gif" && outType === "image"
        ? `out_${quality}_${start}_${x}_${y}_${width}_${height}.${extension}`
        : `out-${filenameInternal}_${quality}_${start}_${end}_${scale}_${fps}_${x}_${y}_${width}_${height}_${speed}_${boomerang}.${extension}`;

    try {
      ffmpeg.FS("stat" as any, `${tmpname}`);
    } catch (e) {
      ffmpeg.FS("writeFile", `${tmpname}`, buffer);
    }

    let file: Uint8Array;
    try {
      onProgress({
        message: "Loading Video...",
      });
      ffmpeg.FS("stat" as any, outname);
      onProgress({
        message: "Done...",
      });
    } catch {
      const args: string[] = [];
      if (Number(start ?? 0) >= 0) {
        args.push("-ss", Number(start ?? 0).toString());

        if (!(outType === "image" && type !== "gif"))
          args.push("-to", (Number(start) + dur).toString());
      } else {
        if (!(outType === "image" && type !== "gif"))
          args.push("-to", dur.toString());
      }

      args.push("-i", `${tmpname}`);

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

        if (speed > 0) {
          filters.push(`setpts=${1 / speed}*PTS`);
        }

        filters.push(`scale=${scale}*in_w:-2`);

        if (boomerang) {
          args.push(
            "-filter_complex",
            `[0:v]${filters.join(
              ","
            )},split=2[begin][mid];[mid]reverse[r];[begin][r]concat=n=2:v=1:a=0[v]`,
            "-map",
            "[v]"
          );
        } else {
          args.push("-vf", filters.join(","));
        }
      }

      switch (type) {
        case "png":
          args.push("-vframes", "1");
          // args.push("-movflags", "frag_keyframe+empty_moov");
          break;
        case "jpg":
          args.push("-vframes", "1");
          // args.push("-movflags", "frag_keyframe+empty_moov");
          break;
        case "mp4":
          args.push("-c:v", "libx264");
          // args.push("-movflags", "frag_keyframe+empty_moov");
          break;
        case "gif":
          verbose(`Saving temp file for ${title}`);

          const gifName = `tmp/gif-${filenameInternal}_${quality}_${start}_${end}_${scale}_${fps}_${x}_${y}_${width}_${height}_${speed}_${boomerang}.mp4`;

          args.push("-c:v", "libx264");

          args.push(gifName);

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

    file = ffmpeg.FS("readFile", outname) as Uint8Array;

    return {
      file: new File([file], `${filename ?? filenameInternal}.${extension}`, {
        type: mimetype,
      }),
      type: outType,
      name: `${filename ?? filenameInternal}.${extension}`,
    };
  } catch (error) {
    console.log(error);
    throw new Error("Oops");
  }
};
