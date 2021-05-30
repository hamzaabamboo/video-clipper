export const convertToCorrectFormat = async (
  file: File,
  onProgress?: (str: any) => void
): Promise<File> => {
  return await new Promise((resolve, reject) => {
    const worker = new Worker(
      //@ts-ignore
      new URL("../../src/worker/worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.postMessage({
      file,
      args: ["-i", "/input/tmpfile", "output.mp4"],
      output: "output.mp4",
      outname: "output.mp4",
      mimetype: "video/mp4",
    });
    worker.onmessage = ({ data }) => {
      if ("progress" in data) {
        onProgress?.(data.progress);
        return;
      }
      if ("error" in data) reject(data.error);
      resolve(data);
    };
  });
};
