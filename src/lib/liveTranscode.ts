import { resolve } from "path";
import { sleep } from "utils/sleep";

export const liveTranscodeTs = async (
  file: File,
  onProgress?: (str: any) => void
): Promise<MediaSource> => {
  const mediaSource = new MediaSource();

  mediaSource.addEventListener("sourceopen", async () => {
    console.log("source open");
    const worker = new Worker(
      //@ts-ignore
      new URL("../../src/worker/worker.ts", import.meta.url),
      { type: "module" }
    );
    console.log("start worker");
    worker.postMessage({
      file,
      args: [
        "-i",
        "/input/tmpfile",
        // Encode for MediaStream
        "-segment_format_options",
        "movflags=frag_keyframe+empty_moov+default_base_moof",
        // encode 5 second segments
        "-segment_time",
        "1",
        "-vf",
        "scale='min(in_w, 1280)':-1",
        // write to files by index
        "-f",
        "segment",
        "/output/%d.mp4",
      ],
      output: "output.mp4",
      outname: "output.mp4",
      mimetype: "video/mp4",
      isStream: true,
    });

    let processing = false;
    const segments = [];

    const sourceBuf = mediaSource.addSourceBuffer(
      'video/mp4; codecs="avc1.4D4001,mp4a.40.2"'
    );

    const flushBuffer = async () => {
      processing = true;
      while (segments.length > 0) {
        const { part, buffer } = segments.shift();
        mediaSource.duration = 1 + part * 1;
        sourceBuf.timestampOffset = part * 1;
        sourceBuf.appendBuffer(buffer);
        await new Promise((resolve) =>
          sourceBuf.addEventListener("updateend", resolve)
        );
      }
      processing = false;
    };
    worker.onmessage = ({ data }) => {
      if ("segment" in data) {
        const { part, buffer } = data.segment;
        segments.push(buffer);
        if (!processing) flushBuffer();
        return;
      }
      if ("progress" in data) {
        onProgress?.(data.progress);
        return;
      }
      if ("error" in data) throw data.error;
      mediaSource.endOfStream();
    };
  });
  return mediaSource;
};
