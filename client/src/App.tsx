import React, { useState, useEffect, useRef, useMemo } from "react";
import { Range } from "rc-slider";
import { Slider } from "./components/Slider";
import axios from "axios";
import qs from "querystring";
import "./styles/tailwind.css";
import "rc-slider/assets/index.css";
import { clipStream, downloadVideo, ffmpeg, MEDIA_TYPES } from "./clipper";
import { Dimension, Coordinate, Cropper } from "./components/Cropper";

const calculateFps = (w: number, h: number, fps: number, length: number) => {
  return (4 * (w * h * fps * length)) / 8;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_WIDTH = 720;
type SourceType = "youtube" | "upload";
const App = () => {
  const [url, setUrl] = useState<string>(
    "https://www.youtube.com/watch?v=ebSce4xUjo0"
  );
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [video, setVideoSrc] = useState<{
    url: string;
    title: string;
    type: SourceType;
    quality: number | "local";
  }>();

  const [videoTitle, setVideoTitle] = useState<string>();
  const [videoRes, setVideoRes] = useState<any[]>([]);
  const [videoQuality, setVideoQuality] = useState<number>();

  const [clip, setClip] = useState<[number, number]>([0, 0]);
  const [fps, setFps] = useState<number>(30);
  const [loop, setLoop] = useState<boolean>(true);
  const [res, setRes] = useState<{
    src: string;
    type: string;
    name: string;
  }>();
  const [mode, setMode] = useState<SourceType>("youtube");
  const [isFFMpegLoading, setFFMpegLoading] = useState(false);
  const [convertProgress, setConvertProgress] = useState<{
    message: string;
    ratio?: number;
  }>();

  const [dimension, setDimensions] = useState<Dimension>({
    width: 1,
    height: 1,
  });
  const [cropDimension, setCropDimesion] = useState<Dimension>({
    width: 1,
    height: 1,
  });

  const [cropPosition, setCropPosition] = useState<Coordinate>({
    x: 0,
    y: 0,
  });

  const [outType, setOutType] = useState<keyof typeof MEDIA_TYPES>("gif");

  const [resScale, setResScale] = useState<number>(1);
  const [resFps, setResFps] = useState<number>(30);

  const [isPlaying, _setPlaying] = useState<boolean>(false);
  const [isCropping, setCropping] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cropperRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const size = useMemo(() => {
    return calculateFps(
      dimension.width * (isCropping ? cropDimension.width : 1) * resScale,
      dimension.height * (isCropping ? cropDimension.height : 1) * resScale,
      resFps,
      clip[1] - clip[0]
    );
  }, [
    clip,
    resFps,
    resScale,
    isCropping,
    dimension.width,
    cropDimension.width,
    dimension.height,
    cropDimension.height,
  ]);

  const seekingRef = useRef(false);

  const setPlaying = (play: boolean) => {
    if (play) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
    _setPlaying(play);
  };

  const updateProgress = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setProgress(time);
  };

  useEffect(() => {
    setUrl(localStorage.getItem("videoUrl") ?? "");
    let done = false;
    const f = async () => {
      await axios.get("/clipper/ping");
      await sleep(10000);
      if (!done) {
        await f();
      } else {
        console.log("bye");
      }
    };
    const g = async () => {
      setFFMpegLoading(true);
      if (!ffmpeg?.isLoaded()) await ffmpeg.load();
      console.log("FFMpeg Ready!");
      setFFMpegLoading(false);
    };
    f();
    g();
    if (!videoRef.current) return;
    videoRef.current.ondurationchange = () => {
      setDuration(Number(videoRef.current?.duration ?? 0));
      setClip([0, Number(videoRef.current?.duration)]);
    };
    videoRef.current.onloadedmetadata = () => {
      setPlaying(true);
      if (!videoRef.current) return;
      videoRef.current.muted = false;
      setFps(30);
      setDuration(Number(videoRef.current?.duration ?? 0));
      setDimensions({
        width: videoRef.current?.videoWidth ?? 0,
        height: videoRef.current?.videoHeight ?? 0,
      });
      setResScale(
        (DEFAULT_WIDTH / videoRef.current?.videoWidth > 1
          ? 1
          : DEFAULT_WIDTH / videoRef.current?.videoWidth) ?? 1
      );
      cropperRef.current.resetCrop();
      setVolume(50);
    };
    return () => {
      done = true;
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (clip[1] && !seekingRef.current && progress >= clip[1]) {
      if (!loop) updateProgress(clip[0]);
      else setPlaying(false);
    } else if (progress < clip[0]) {
      if (!videoRef.current?.paused) setPlaying(false);
      updateProgress(clip[0]);
    }
  }, [progress, clip, loop]);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.key === " ") {
        if (videoRef.current?.paused) setPlaying(true);
        else setPlaying(false);
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
      }
    };
    window.addEventListener("keypress", toggle);
    return () => {
      window.removeEventListener("keypress", toggle);
    };
  }, [video]);

  useEffect(() => {
    const info = videoRes.find((e) => e.itag === videoQuality);
    console.log(info, videoQuality, videoRes);
    if (!videoQuality || !info) return;
    setVideoSrc({
      url: info.url,
      title: videoTitle ?? "",
      type: "youtube",
      quality: videoQuality,
    });
    setFps(info.fps);
  }, [videoRes, videoQuality, videoTitle]);

  const getVidData = async () => {
    try {
      localStorage.setItem("videoUrl", url);
      const {
        data: { title, allFormats },
      } = await axios.get("/clipper/vid?" + qs.encode({ url }));
      console.log(allFormats);
      setVideoTitle(title);
      setVideoRes(
        allFormats.filter((e) => e.container === "mp4" && e.hasVideo)
      );
      setVideoQuality(22);
    } catch {
      setVideoSrc(undefined);
    }
  };

  const convert = async () => {
    if (!video) return;
    try {
      let buffer: Uint8Array;
      switch (video.type) {
        case "upload":
          setConvertProgress({
            message: "Loading Video...",
          });
          const videoFile = fileInputRef?.current?.files?.[0];
          if (!videoFile) return;
          buffer = new Uint8Array((await videoFile.arrayBuffer()) ?? []);
          setConvertProgress({
            message: "Loading Video...",
          });
          break;
        default:
          setConvertProgress({
            message: "Downloading Video...",
          });
          buffer = await downloadVideo(url, video?.title ?? "", video.quality);
          setConvertProgress({
            message: "Video Downloaded",
          });
          break;
      }
      const r = await clipStream(
        buffer,
        video?.title,
        clip[0],
        clip[1],
        outType,
        video.quality,
        undefined,
        resFps,
        resScale,
        cropPosition.x,
        cropPosition.y,
        cropDimension.width,
        cropDimension.height,
        (progress) => setConvertProgress(progress)
      );
      setRes({
        src: URL.createObjectURL(r.file),
        type: r.type,
        name: r.name,
      });
    } catch (e) {
      setConvertProgress({
        message: "Something Went Wrong... " + e,
      });
    }
  };

  const loadVideo = async () => {
    const video = fileInputRef?.current?.files?.[0];
    if (!video) return;
    setVideoSrc({
      url: URL.createObjectURL(video),
      title: video.name.split(".").slice(undefined, -1).join(""),
      type: "upload",
      quality: "local",
    });
    if (!videoRef.current) return;
  };

  return (
    <div className="flex justify-center flex-col items-center min-h-screen w-screen py-2">
      <div className="flex justify-center flex-col items-center py-2 w-full">
        <h1 className="text-6xl font-bold text-center">
          Video Clipping Tool V1.7!
        </h1>
        <Cropper
          ref={cropperRef}
          onUpdateCrop={(position, dimension) => {
            setCropDimesion(dimension);
            setCropPosition(position);
          }}
          isCropping={isCropping}
        >
          <video
            ref={videoRef}
            src={video?.url}
            className="w-full mb-2"
            onVolumeChange={(e) => {
              setVolume((e.target as HTMLVideoElement).volume * 100);
            }}
            onTimeUpdate={(e) => {
              setProgress((e.target as HTMLVideoElement).currentTime);
            }}
            onPlay={(e) => {
              if ((e.target as HTMLVideoElement).currentTime >= clip[1]) {
                setProgress(clip[0]);
                (e.target as HTMLVideoElement).currentTime = clip[0];
              }
            }}
            autoPlay
            // controls
          ></video>
        </Cropper>
        <div className="flex grid gap-2 grid-cols-2 w-4/5 mx-auto">
          <div>
            <button
              className="rounded border bg-blue-500 mr-2 my-2 p-2 text-white"
              onClick={() => setMode(mode === "youtube" ? "upload" : "youtube")}
            >
              Change Mode
            </button>
            {mode === "youtube" ? (
              <div>
                <span className="text-lg font-bold mb-2">Youtube Video</span>
                <input
                  type="text"
                  className="p-2 mr-2 rounded border w-full border-black"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button
                  className="rounded border bg-red-500 mr-2 my-2 p-2 text-white"
                  onClick={() => getVidData()}
                >
                  Load video
                </button>
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(Number(e.target.value))}
                >
                  {videoRes.map((e) => (
                    <option key={e.itag} value={e.itag}>
                      {e.quality} {e.qualityLabel ? `(${e.qualityLabel})` : ""}{" "}
                      {e.hasVideo && "Video"} {e.hasAudio && "Audio"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <span className="text-lg font-bold mb-2">Upload Video</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="p-2 mr-2 rounded border w-full border-black block text-overflow-ellipsis overflow-hidden whitespace-nowrap"
                  accept="video/*, .mkv"
                />
                <button
                  className="rounded border bg-red-500 mr-2 my-2 p-2 text-white"
                  onClick={() => loadVideo()}
                >
                  Upload video
                </button>
              </div>
            )}
            <div>
              <button
                className="rounded border bg-blue-500 mr-2 my-2 p-2 text-white"
                onClick={() => setPlaying(!isPlaying)}
              >
                {!isPlaying ? "Play" : "Pause"}
              </button>
              <button
                className="rounded border bg-green-500 mr-2 my-2 p-2 text-white"
                onClick={() => setLoop(!loop)}
              >
                {!loop ? "No Loop" : "Loop"}
              </button>
            </div>
            <div className="w-80 flex items-center mb-2">
              <input
                type="number"
                step=".01"
                className="p-2 rounded border border-black flex-shrink"
                value={clip[0]}
                min={0}
                max={clip[1]}
                onChange={(e) => {
                  updateProgress(Number(e.target.value));
                  setProgress(Number(e.target.value));
                  setClip([Number(e.target.value), clip[1]]);
                }}
              />
              <div className="px-4 w-100 flex-grow">
                <Range
                  allowCross={false}
                  step={0.01}
                  min={0}
                  max={duration}
                  defaultValue={[0, 1]}
                  value={clip}
                  onBeforeChange={() => {
                    seekingRef.current = true;
                    videoRef.current?.pause();
                  }}
                  onAfterChange={() => {
                    seekingRef.current = false;
                    videoRef.current?.pause();
                  }}
                  onChange={(r) => {
                    if (clip[0] !== r[0]) {
                      updateProgress(r[0]);
                    } else {
                      updateProgress(r[1]);
                    }
                    setClip(r as [number, number]);
                  }}
                />
              </div>
              <input
                type="number"
                className="p-2 rounded border border-black flex-shrink"
                step=".01"
                value={clip[1]}
                min={clip[0]}
                max={duration}
                onChange={(e) => {
                  updateProgress(Number(e.target.value));
                  setClip([clip[0], Number(e.target.value)]);
                }}
              />
            </div>
            <div className="flex flex-col mb-2">
              <span className="text-lg font-bold mb-2">Progress</span>
              <Slider
                step={0.01}
                max={clip[1] ?? duration ?? 0}
                min={clip[0] ?? 0}
                value={progress}
                onChange={(e) => {
                  updateProgress(e);
                }}
              />
              <div className="flex">
                <button
                  className="rounded bg-blue-200 p-2 mr-2"
                  onClick={() => {
                    setClip([progress, clip[1]]);
                  }}
                >
                  Set Start
                </button>
                <button
                  className="rounded bg-blue-200 p-2"
                  onClick={() => {
                    setClip([clip[0], progress]);
                  }}
                >
                  Set End
                </button>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold mb-2">Volume</span>
              <input
                type="range"
                max="100"
                min="0"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="p-2"
              />
            </div>
          </div>
          <div>
            <div className="flex flex-col">
              <span className="text-lg font-bold mb-2">Fps</span>
              <div>
                <Slider
                  step={0.01}
                  max={fps}
                  min={0}
                  value={resFps}
                  onChange={(e) => {
                    setResFps(e);
                  }}
                />
                <button
                  className="rounded bg-blue-400 mr-2 p-2"
                  onClick={() => setResFps(10)}
                >
                  10fps
                </button>
                <button
                  className="rounded bg-blue-400 mr-2 p-2"
                  onClick={() => setResFps(15)}
                >
                  15fps
                </button>
                <button
                  className="rounded bg-blue-400 mr-2 p-2"
                  onClick={() => setResFps(21)}
                >
                  21fps
                </button>
              </div>
              <span className="text-lg font-bold mb-2">Scale</span>
              <div>
                <Slider
                  step={0.01}
                  max={1}
                  min={0}
                  value={resScale}
                  onChange={(e) => {
                    setResScale(e);
                  }}
                />
                <button
                  className="rounded bg-blue-400 p-2  mr-2"
                  onClick={() => setResScale(1)}
                >
                  100%
                </button>
                <button
                  className="rounded bg-blue-400 p-2  mr-2"
                  onClick={() => setResScale(0.75)}
                >
                  75%
                </button>
                <button
                  className="rounded bg-blue-400 p-2  mr-2"
                  onClick={() => setResScale(0.5)}
                >
                  50%
                </button>
                <button
                  className="rounded bg-blue-400 p-2  mr-2"
                  onClick={() => setResScale(0.25)}
                >
                  25%
                </button>
                <span>
                  {dimension.width * resScale} x {dimension.height * resScale}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Crop</h3>
              <div className="flex-row">
                <button
                  className="rounded bg-blue-400 p-2 mr-2"
                  onClick={() => setCropping((c) => !c)}
                >
                  {isCropping ? "No Crop" : "Crop"}
                </button>
                <button
                  className="rounded bg-blue-400 p-2 mr-2"
                  onClick={() => cropperRef.current.resetCrop()}
                >
                  Reset Crop
                </button>
              </div>
            </div>
            <div>
              <select
                value={outType}
                onChange={(e) =>
                  setOutType(e.target.value as keyof typeof MEDIA_TYPES)
                }
              >
                {Object.keys(MEDIA_TYPES).map((e) => (
                  <option key={e} value={e}>
                    {e.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <span>
              Approx size: {size / 1000000} MB (
              {Math.round(
                dimension.width *
                  (isCropping ? cropDimension.width : 1) *
                  resScale
              )}
              x
              {Math.round(
                dimension.height *
                  (isCropping ? cropDimension.height : 1) *
                  resScale
              )}
              px)
            </span>
            <div>
              <button
                className={`rounded p-2 ${
                  !isFFMpegLoading ? "bg-blue-400" : "bg-gray-500"
                }`}
                onClick={convert}
                disabled={isFFMpegLoading}
              >
                Generate !
              </button>
              <a
                className={`rounded p-2 mx-2 ${
                  res?.src ? "bg-blue-600" : "bg-gray-500"
                }`}
                href={res?.src}
                target="__blank"
                download={res?.name}
              >
                Download !
              </a>
            </div>
          </div>
        </div>
        <div className="p-2">
          {convertProgress &&
            `${convertProgress.message} ${
              (convertProgress.ratio ?? 0) > 0
                ? convertProgress.ratio + "%"
                : ""
            }`}
        </div>
        <div className="p-2">
          {res?.type === "image" ? (
            <img alt={res?.name} src={res?.src} />
          ) : res?.type === "audio" ? (
            <audio controls>
              <source src={res?.src}></source>
            </audio>
          ) : (
            <video src={res?.src} controls></video>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
