import axios from "axios";
import { roundToNDecimalPlaces } from "../utils/roundToNDecimal";
import { QualityLabel, verbose } from "./clipper";

const cache: Record<string, File> = {};

export const downloadVideo = async (
  url: string,
  title: string,
  quality: QualityLabel,
  onProgress: (proress: { message: string; ratio?: number }) => void = () => {}
): Promise<File> => {
  if (!url) throw new Error("Url is not supplied");

  verbose("[clipper] downloading info");

  const key = url + "-" + quality;

  if (key in cache) {
    onProgress({
      message: "Cache Hit",
    });
    return cache[key];
  }

  const {
    data: { size: filesize },
  } = await axios.get<{ size: number }>(
    "api/getSize?url=" + url + "&quality=" + quality
  );
  const arr = new Uint8Array(
    (
      await axios.get("api/dlVid?url=" + url + "&quality=" + quality, {
        responseType: "arraybuffer",
        onDownloadProgress: (progress) => {
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
  );
  const file = new File([arr], title);
  cache[key] = file;
  return file;
};
