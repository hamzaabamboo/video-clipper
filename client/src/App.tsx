import React, { useState, useEffect, useRef, useMemo } from "react";
import { Range } from "rc-slider";
import { Slider } from "./components/Slider";
import axios from "axios";
import qs from "querystring";
import "./styles/tailwind.css";
import "rc-slider/assets/index.css";
import { clipStream, ffmpeg } from "./clipper";
import { Dimension, Coordinate, Cropper } from "./components/Cropper";

const calculateFps = (w: number, h: number, fps: number, length: number) => {
  return (4 * (w * h * fps * length)) / 8;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const App = () => {
  const [url, setUrl] = useState<string>(
    "https://www.youtube.com/watch?v=ebSce4xUjo0"
  );
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [video, setVideoSrc] = useState<{ url: string; title: string }>();
  const [clip, setClip] = useState<[number, number]>([0, 0]);
  const [fps, setFps] = useState<number>(30);
  const [loop, setLoop] = useState<boolean>(true);
  const [res, setRes] = useState<string>("");
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

  const [resScale, setResScale] = useState<number>(1);
  const [resFps, setResFps] = useState<number>(30);

  const [isPlaying, _setPlaying] = useState<boolean>(false);
  const [isCropping, setCropping] = useState<boolean>(false);

  const [maxQuality, setMaxQuality] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cropperRef = useRef<any>(null);

  const dlUrl = useMemo(() => {
    return (
      url &&
      clip &&
      "clip?" +
        qs.encode({
          url,
          start: clip[0],
          end: clip[1],
          fps: resFps,
          scale: resScale,
          ...(isCropping ? cropDimension : {}),
          ...(isCropping ? cropPosition : {}),
          max: maxQuality,
        })
    );
  }, [
    url,
    clip,
    resFps,
    resScale,
    cropDimension,
    cropPosition,
    isCropping,
    maxQuality,
  ]);

  const size = useMemo(() => {
    return calculateFps(
      (maxQuality ? 1980 : dimension.width) *
        (isCropping ? cropDimension.width : 1) *
        resScale,
      (maxQuality ? 1980 : dimension.height) *
        (isCropping ? cropDimension.height : 1) *
        resScale,
      resFps,
      clip[1] - clip[0]
    );
  }, [
    clip,
    resFps,
    resScale,
    isCropping,
    maxQuality,
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

  const getVid = async () => {
    try {
      localStorage.setItem("videoUrl", url);
      const {
        data: { title, data, bestVideo },
      } = await axios.get("/clipper/vid?" + qs.encode({ url }));
      console.log(data);
      setVideoSrc({
        url: data.url,
        title,
      });
      if (videoRef.current) {
        setPlaying(true);
        videoRef.current.muted = false;
      }
      setFps(data.fps);
      setDuration(Number(data.approxDurationMs) / 1000);
      setClip([0, Number(data.approxDurationMs) / 1000]);
      setDimensions({
        width: bestVideo.width,
        height: bestVideo.height,
      });
      cropperRef.current.resetCrop();
      setVolume(50);
    } catch {
      setVideoSrc(undefined);
    }
  };

  const getGif = async () => {
    if (!video) return;
    try {
      const r = await clipStream(
        url,
        video?.title,
        clip[0],
        clip[1],
        "gif",
        "bobo",
        resFps,
        resScale,
        cropPosition.x,
        cropPosition.y,
        cropDimension.width,
        cropDimension.height,
        (progress) => setConvertProgress(progress)
      );
      setRes("data:image/gif;base64, " + r);
    } finally {
    }
  };

  return (
    <div className="flex justify-center flex-col items-center min-h-screen w-screen py-2">
      <div className="flex justify-center flex-col items-center py-2 w-full">
        <h1 className="text-6xl font-bold text-center">
          Video Clipping Tool V1.5!
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
            <div>
              <input
                type="text"
                className="p-2 mr-2 rounded border w-full border-black"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                className="rounded border bg-red-500 mr-2 my-2 p-2 text-white"
                onClick={() => getVid()}
              >
                Load video
              </button>
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
              <span className="text-lg font-bold mb-2">Quality</span>
              <div className="flex-row">
                <button
                  className="rounded bg-blue-400 p-2 mr-2"
                  onClick={() => setMaxQuality((c) => !c)}
                >
                  {maxQuality ? "Max Quality" : "Normal Quality"}
                </button>
              </div>
            </div>
            <span>
              Approx size: {size / 1000000} MB (
              {Math.round(
                (maxQuality ? 1980 : dimension.width) *
                  (isCropping ? cropDimension.width : 1) *
                  resScale
              )}
              x
              {Math.round(
                (maxQuality ? 1080 : dimension.height) *
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
                onClick={getGif}
                disabled={isFFMpegLoading}
              >
                Generate GIF !
              </button>
              {dlUrl && (
                <>
                  <a
                    className="mx-2"
                    href={"/clipper/" + dlUrl + "&download=true"}
                    target="__blank"
                  >
                    Download GIF !
                  </a>
                  <a
                    className="mx-2"
                    href={"/clipper/" + dlUrl + "&type=mp3&download=true"}
                    target="__blank"
                  >
                    Download MP3 !
                  </a>
                  <a
                    className="mx-2"
                    href={"/clipper/" + dlUrl + "&type=mp4&download=true"}
                    target="__blank"
                  >
                    Download MP4 !
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-2">
          {convertProgress &&
            `${convertProgress.message} ${
              convertProgress.message ? convertProgress.message + "%" : ""
            }`}
        </div>
        <div className="p-2">{res && <img alt="result gif" src={res} />}</div>
      </div>
    </div>
  );
};

export default App;
