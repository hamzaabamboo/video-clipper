import { ffmpeg } from "../clipper";

export const processMp4 = async (args: string[], files: File[]) => {
  console.log(args, files);
  await new Promise((resolve) => {
    let worker = new Worker("./ffmpeg-worker-mp4.js");
    worker.addEventListener("message", function (msg) {
      switch (msg.data.type) {
        case "stdout":
          console.log(msg.data);
          break;
        case "stderr":
          console.log(msg.data);
          break;
        case "ready":
          break;
        case "done":
          resolve(null);
          worker.terminate();
          console.log(msg.data.data);
          break;
      }

      worker.postMessage({
        type: "run",
        arguments: args,
        mounts: [
          {
            type: "WORKERFS",
            opts: {
              blobs: [{ name: "abc.mkv", data: files[0] }],
            },
            mountpoint: "/test",
          },
        ],
        // WORKERFS: [{ name: fileList[0].name,  data: fileList[0] }],
      });
    });

    console.log(ffmpeg.FS("stat", "/test/abc.mkv"));
  });
};
