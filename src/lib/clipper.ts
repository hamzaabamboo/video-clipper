import { ClippingOptions, Duration } from "src/types/clipping";
import { MEDIA_TYPES } from "../constants/mediaTypes";
import gifsicle from "gifsicle-wasm-browser";

export const verbose = (e: string) => console.log(e);

const round = (n: number) => Math.round(n * 100) / 100;

export type QualityLabel = number | "local";

export const clipStream = async (
  source: File,
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
      optimizeGif: true,
    },
  },
  onProgress: (progress: {
    message: string;
    ratio?: number;
  }) => void = () => {},
  onLog?: (message: string) => void
): Promise<{ file: Blob; type: string; name: string }> => {
  const { fps, scale, crop, speed, flags, filename } = options;
  const { start, end } = duration;
  const { x, y, width, height } = crop;
  const { boomerang, optimizeGif } = flags;

  const dur = Number(end) - Number(start);
  if (type === "gif" && dur > 60) {
    throw new Error("Duration too long");
  }
  if (isNaN(Number(end)) || isNaN(Number(start))) {
    throw new Error("Invalid start/end time");
  }

  try {
    verbose("[clipper] downloading info");

    const {
      extension,
      mimetype,
      type: outType,
      convertExtension,
    } = MEDIA_TYPES[type];

    const filenameInternal = `${encodeURIComponent(title)}`;
    const tmpname = source.name;
    const outname =
      type !== "gif" && outType === "image"
        ? `out_${quality}_${start}_${x}_${y}_${width}_${height}.${
            convertExtension ?? extension
          }`
        : `out-${filenameInternal}_${quality}_${start}_${end}_${scale}_${fps}_${x}_${y}_${width}_${height}_${speed}_${boomerang}.${
            convertExtension ?? extension
          }`;

    const args = getArgs("/input/tmpfile", outname, type, duration, options);

    console.log(args);

    let file: File = await new Promise((resolve, reject) => {
      const worker = new Worker(
        //@ts-ignore
        new URL("../../src/worker/worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.postMessage({
        file: source,
        args,
        output: outname,
        outname: `${filename ?? filenameInternal}.${extension}`,
        mimetype,
      });
      worker.onmessage = ({ data }) => {
        if (data.type === "log") {
          onLog?.(data.data);
          return;
        }
        if ("progress" in data) {
          console.log(data);
          onProgress({
            message: data.progress,
          });
          return;
        }
        if ("error" in data) reject(data.error);
        onProgress({
          message: "Done",
        });
        resolve(data);
      };
    });
    if (type === "gif" && optimizeGif) {
      onProgress({
        message: "Optimizing Gif",
      });
      const files = await gifsicle.run({
        input: [{ file, name: "input.gif" }],
        command: [`-O2 --lossy=60 input.gif -o /out/${outname}`],
      });
      file = files[0];
    }
    onProgress({
      message: "Done !",
    });
    return {
      file,
      type: outType,
      name: `${filename ?? filenameInternal}.${extension}`,
    };
  } catch (error) {
    console.log(error);
    throw new Error("Oops");
  }
};

const getArgs = (
  input: string,
  output: string,
  type: keyof typeof MEDIA_TYPES,
  duration: Duration,
  options: ClippingOptions
) => {
  const { fps, scale, crop, speed, flags } = options;
  const { start, end } = duration;
  const { x, y, width, height } = crop;
  const { boomerang, fadeout, loop } = flags;
  const { type: outType } = MEDIA_TYPES[type];
  const args: string[] = [];

  if (Number(start ?? 0) >= 0) {
    args.push("-ss", Number(start ?? 0).toString());

    if (!(outType === "image" && type !== "gif"))
      args.push("-to", Number(end).toString());
  }

  args.push("-i", `${input}`);

  if (type !== "mp3") {
    const filters: string[] = [];
    const filterComplex: string[] = [];

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

    if (fps) {
      filters.push(`fps=${fps}`);
    }
    filters.push(`scale=${scale}*in_w:-2:flags=lanczos`);

    if (boomerang)
      filterComplex.push(
        "split=2[begin][mid];[mid]reverse[r];[begin][r]concat=n=2:v=1:a=0"
      );
    if (fadeout) {
      const duration = 0.12;
      const len = boomerang
        ? 2 * (Number(end) - Number(start))
        : Number(end) - Number(start);
      filterComplex.push(
        `split=2[normal][fade];[normal]trim=start=${duration},setpts=PTS-STARTPTS[start];[fade]trim=duration=${duration},setpts=PTS-STARTPTS
        [end];[start][end]xfade=transition=fade:duration=${duration}:offset=${
          len - 2 * duration
        }`
      );
    }
    if (type === "gif" || type === "apng")
      filterComplex.push(
        "split[s0][s1];[s0]palettegen=reserve_transparent=on:transparency_color=ffffff:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2:diff_mode=rectangle"
      );

    if (filterComplex.length > 0) {
      args.push(
        "-filter_complex",
        `[0:v]${filters.join(",")}${
          (filterComplex && "," + filterComplex.join(",")) || ""
        }[v]`,
        "-map",
        "[v]"
      );
    } else {
      args.push("-vf", filters.join(","));
    }
  }

  switch (type) {
    case "apng":
      args.push("-dpi", "256");
      if (loop) {
        args.push("-plays", "0");
      }
      break;
    case "png":
      args.push("-vframes", "1");
      break;
    case "jpg":
      args.push("-vframes", "1");
      break;
    case "mp4":
      args.push("-c:v", "libx264");
      break;
    case "gif":
      break;
  }

  args.push(output);

  return args;
};
