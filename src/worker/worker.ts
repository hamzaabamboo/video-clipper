import type createFFmpegCore from "@ffmpeg/core";

const ctx: Worker = self as any;
(ctx as any).importScripts("/ffmpeg-core.js");
// (ctx as any).importScripts("/gifsicle.js");

class FFmpeg {
  ffmpegCore = null;
  ffmpegMain = null;
  videoFile = null;
  running = false;
  runResolve = null;
  fileCount = 0;
  defaultArgs = [
    /* args[0] is always the binary path */
    "./ffmpeg",
    /* Disable interaction mode */
    "-nostdin",
    /* Force to override output file */
    "-y",
  ];

  detectCompletion(message) {
    if (message === "FFMPEG_END" && this.runResolve !== null) {
      this.runResolve();
      this.runResolve = null;
      this.running = false;
    }
  }

  log(message) {
    // console.log("ffmpeg:", message);
    postMessage({ type: "log", data: message });
    this.detectCompletion(message);
  }

  async createCore() {
    try {
      return await createFFmpegCore({
        mainScriptUrlOrBlob: "/ffmpeg-core.js",
        printErr: (message) => this.log(message),
        print: (message) => this.log(message),
        locateFile: (path, prefix) => {
          if (path.endsWith("ffmpeg-core.wasm")) {
            return "/ffmpeg-core.wasm";
          }
          if (path.endsWith("ffmpeg-core.worker.js")) {
            return "/ffmpeg-core.worker.js";
          }
          return prefix + path;
        },
      });
    } catch (e) {
      if (e.message === "bad memory") {
        throw new Error(
          `ffmpeg didn't start. #enable-webassembly-threads may not be enabled in chrome://flags. Open chrome console for more info.`
        );
      }
      throw new Error(`ffmpeg didn't start: ` + e.message);
    }
  }

  async load() {
    if (this.ffmpegCore) return "ffmpeg already loaded";

    this.ffmpegCore = await this.createCore();
    this.ffmpegMain = this.ffmpegCore.cwrap("proxy_main", "number", [
      "number",
      "number",
    ]);
    return "Loaded ffmpeg";
  }

  updateFile(newFile) {
    this.videoFile = newFile;
    const FS = this.ffmpegCore.FS;
    const rootDirs = FS.readdir("/");
    if (rootDirs.indexOf("input") === -1) {
      FS.mkdir("/input");
    } else {
      this.ffmpegCore.FS_unmount("/input");
    }
    if (rootDirs.indexOf("output") === -1) {
      FS.mkdir("/output");
    }

    const WORKERFS = this.ffmpegCore.FS_filesystems.WORKERFS;
    const tmpfile = new File([newFile], "tmpfile", { type: newFile.type });
    this.ffmpegCore.FS_mount(WORKERFS, { files: [tmpfile] }, "/input");
  }

  parseArgs(args) {
    const argsPtr = this.ffmpegCore._malloc(
      args.length * Uint32Array.BYTES_PER_ELEMENT
    );
    args.forEach((s, idx) => {
      const buf = this.ffmpegCore._malloc(s.length + 1);
      this.ffmpegCore.writeAsciiToMemory(s, buf);
      this.ffmpegCore.setValue(
        argsPtr + Uint32Array.BYTES_PER_ELEMENT * idx,
        buf,
        "i32"
      );
    });
    return [args.length, argsPtr];
  }

  FS(method, ...args) {
    if (!this.ffmpegCore)
      throw new Error("Failed to run command. ffmpeg isn't loaded yet");
    var ret = null;
    try {
      ret = this.ffmpegCore.FS[method](...args);
    } catch (e) {
      if (method === "readdir") {
        throw Error(
          `ffmpeg.FS('readdir', '${args[0]}') error. Check if the path exists, ex: ffmpeg.FS('readdir', '/')`
        );
      } else if (method === "readFile") {
        throw Error(
          `ffmpeg.FS('readFile', '${args[0]}') error. Check if the path exists`
        );
      } else {
        throw Error("Oops, something went wrong in FS operation.");
      }
    }
    return ret;
  }

  async run(..._args) {
    if (!this.ffmpegCore)
      throw new Error("Failed to run command. ffmpeg isn't loaded yet");
    else if (this.running) {
      throw new Error("ffmpeg.wasm can only run one command at a time");
    } else {
      this.running = true;
      return new Promise((resolve) => {
        const args = [...this.defaultArgs, ..._args].filter(
          (s) => s.length !== 0
        );
        console.log(`Run: ${args.join(" ")}`);
        this.runResolve = resolve;
        this.ffmpegMain(...this.parseArgs(args));
      });
    }
  }
}

const fileExists = (file) => ffmpeg.FS("readdir", "/output/").includes(file);
const readFile = (file) => ffmpeg.FS("readFile", file);

const ffmpeg = new FFmpeg();

ctx.onmessage = async ({
  data: { file, args, output, outname, mimetype, isStream },
}) => {
  let part = 0;

  const onProgress = (msg: string) => {
    ctx.postMessage({
      progress: msg,
    });
  };

  try {
    onProgress("Initializing FFmpeg");
    await ffmpeg.load();
    try {
      ffmpeg.FS("readFile", output);
    } catch {
      onProgress("Loading Video Data");
      ffmpeg.updateFile(file);
      onProgress("Running FFMpeg");
      if (isStream) {
        setInterval(() => {
          // periodically check for files that have been written
          if (fileExists(`${part + 1}.mp4`)) {
            ctx.postMessage({
              segment: {
                part,
                buffer: readFile(`/output/${part}.mp4`),
              },
            });
            part++;
          }
        }, 200);
      }
      await ffmpeg.run(...args);
      if (isStream) {
        while (fileExists(`${part}.mp4`)) {
          ctx.postMessage({
            segment: {
              part,
              buffer: readFile(`/output/${part}.mp4`),
            },
          });
          part++;
        }
      }

      const tmp = ffmpeg.FS("readFile", output);

      // await new Promise((resolve) =>
      //   Gifsicle({
      //     mainScriptUrlOrBlob: "/gifsicle.js",
      //     MEMFS: [new File([tmp], outname)],
      //     printErr: (message) => console.log("fuckerr", message),
      //     print: (message) => console.log("fuck", message),
      //     locateFile: (path, prefix) => {
      //       if (path.endsWith("gifsicle.wasm")) {
      //         return "/gifsicle.wasm";
      //       }
      //       if (path.endsWith("gifsicle.worker.js")) {
      //         return "/gifsicle.worker.js";
      //       }
      //       return prefix + path;
      //     },
      //     arguments: ["-O2", output],
      //     callback: async (f) => {
      //       console.log("fuck", f);
      //     },
      //   })
      // );
    }
    if (isStream) {
      ctx.postMessage({});
      return;
    }
    const buffer = ffmpeg.FS("readFile", output);
    let res = buffer;
    // if (mimetype === "image/gif") {
    //   res = await encode(buffer, {
    //     optimizationLevel: 3,
    //   });
    // }
    const f = new File([res], outname, { type: mimetype });
    ctx.postMessage(f);
  } catch (e) {
    console.error(e);
    ctx.postMessage({
      error: e,
    });
  }
};

export {};
