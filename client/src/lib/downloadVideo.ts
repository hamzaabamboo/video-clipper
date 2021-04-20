import axios from "axios";
import { roundToNDecimalPlaces } from "../utils/roundToNDecimal";
import { QualityLabel, verbose, ffmpeg } from "./clipper";

export const downloadVideo = async (
  url: string,
  title: string,
  quality: QualityLabel,
  onProgress: (proress: { message: string; ratio?: number }) => void = () => {}
): Promise<Uint8Array> => {
  if (!url) throw new Error("Url is not supplied");

  verbose("[clipper] downloading info");

  const filenameInternal = `${encodeURIComponent(title)}`;
  const tmpname = `tmp/tmp-${filenameInternal}_${quality}.mp4`;

  verbose("[clipper] downloaded info");
  try {
    console.log(ffmpeg.FS("stat" as any, tmpname));
    verbose("[clipper] using preloaded video");
  } catch (e) {
    const {
      data: { size: filesize },
    } = await axios.get("clipper/size?url=" + url + "&quality=" + quality);

    ffmpeg.FS(
      "writeFile",
      `${tmpname}`,
      new Uint8Array(
        (
          await axios.get("clipper/dlVid?url=" + url + "&quality=" + quality, {
            responseType: "arraybuffer",
            onDownloadProgress: (progress: ProgressEvent) => {
              onProgress({
                message: `Downloading... ${
                  roundToNDecimalPlaces(progress.loaded / 10 ** 6, 2) ?? 0
                } MB/ ${roundToNDecimalPlaces(
                  filesize / 10 ** 6,
                  2
                )} MB (${Math.round((progress.loaded / filesize) * 100)}%)`,
              });
            },
          })
        ).data as ArrayBuffer
      )
    );
  } finally {
    return ffmpeg.FS("readFile", tmpname);
  }
};
