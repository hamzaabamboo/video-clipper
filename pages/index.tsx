import axios from "axios";
import { Button } from "components/Button";
import { Coordinate, Cropper, Dimension } from "components/Cropper";
import { NumberField } from "components/forms/NumberField";
import { Select } from "components/forms/Select";
import { Slider } from "components/forms/Slider";
import { Textfield } from "components/forms/Textfield";
import { Section } from "components/Section";
import { Typography } from "components/Typography";
import { MEDIA_TYPES } from "constants/mediaTypes";
import { clipStream, ffmpeg } from "lib/clipper";
import { downloadVideo } from "lib/downloadVideo";
import qs from "querystring";
import { Range } from "rc-slider";
import "rc-slider/assets/index.css";
import React, { useEffect, useRef, useState } from "react";
import { roundToNDecimalPlaces } from "utils/roundToNDecimal";
import { sleep } from "utils/sleep";

const DEFAULT_WIDTH = 720;
type SourceType = "youtube" | "upload";
const App = () => {
  const [url, setUrl] = useState<string>(
    "https://www.youtube.com/watch?v=ebSce4xUjo0"
  );
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(50);
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
    size: number;
  }>();
  const [mode, setMode] = useState<SourceType>("youtube");
  const [isFFMpegLoading, setFFMpegLoading] = useState(false);
  const [convertProgress, setConvertProgress] = useState<{
    message: string;
    ratio?: number;
  }>();

  const [dimension, setDimensions] = useState<Dimension>({
    width: 0,
    height: 0,
  });
  const [cropDimension, setCropDimesion] = useState<Dimension>({
    width: 1,
    height: 1,
  });

  const [cropPosition, setCropPosition] = useState<Coordinate>({
    x: 0,
    y: 0,
  });

  const [outFilename, setOutFilename] = useState<string>();
  const [outType, setOutType] = useState<keyof typeof MEDIA_TYPES>("gif");

  const [resScale, setResScale] = useState<number>(1);
  const [resFps, setResFps] = useState<number>(30);

  const [speed, setSpeed] = useState<number>(1);

  const [isPlaying, _setPlaying] = useState<boolean>(false);
  const [isCropping, setCropping] = useState<boolean>(false);
  const [isBoomerang, setBoomerang] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cropperRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const seekingRef = useRef(false);

  const setPlaying = (play: boolean) => {
    if (!videoRef.current?.readyState) return;
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
    setVolume(Number(localStorage.getItem("volume")) ?? 0);
    let done = false;
    const ping = async () => {
      await axios.get("api/ping");
      await sleep(10000);
      if (!done) {
        await ping();
      } else {
      }
    };
    const initFFmpeg = async () => {
      setFFMpegLoading(true);
      if (!ffmpeg?.isLoaded()) await ffmpeg.load();
      console.log("FFMpeg Ready!");
      setFFMpegLoading(false);
    };
    ping();
    initFFmpeg();
    if (!videoRef.current) return;
    videoRef.current.volume = Number(localStorage.getItem("volume")) / 100;

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
      console.log(Number(localStorage.getItem("volume")) / 100);
      videoRef.current.volume = Number(localStorage.getItem("volume")) / 100;
    };

    videoRef.current.ondurationchange = () => {
      setDuration(Number(videoRef.current?.duration ?? 0));
      setClip([0, Number(videoRef.current?.duration)]);
    };
    return () => {
      done = true;
    };
  }, []);

  //Volume Controls
  useEffect(() => {
    localStorage.setItem("volume", String(volume));
    if (!videoRef.current) return;
    videoRef.current.volume = volume / 100;
  }, [volume]);

  //Video Controls
  useEffect(() => {
    if (clip[1] && !seekingRef.current && progress >= clip[1]) {
      if (!loop) updateProgress(clip[0]);
      else setPlaying(false);
    } else if (progress < clip[0]) {
      if (!videoRef.current?.paused) setPlaying(false);
      updateProgress(clip[0]);
    }
  }, [progress, clip, loop]);

  //Bind Key to video player
  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.key === " " && (e.target as HTMLElement).tagName !== "INPUT") {
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

  //Change Video
  useEffect(() => {
    const info = videoRes.find((e) => e.itag === videoQuality);
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
      const {
        data: { title, allFormats },
      } = await axios.get("api/vid?" + qs.encode({ url }));
      setVideoTitle(title);
      setVideoRes(
        allFormats.filter((e) => e.container === "mp4" && e.hasVideo)
      );
      setVideoQuality(allFormats.some((e) => e.itag === 22) ? 22 : 18);
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
          buffer = await downloadVideo(
            url,
            video?.title ?? "",
            video.quality,
            setConvertProgress
          );
          setConvertProgress({
            message: "Video Downloaded",
          });
          break;
      }
      const r = await clipStream(
        buffer,
        video?.title,
        { start: clip[0], end: clip[1] },
        outType,
        video.quality,
        {
          filename: outFilename,
          fps: resFps,
          scale: resScale,
          crop: { ...cropPosition, ...cropDimension },
          speed,
          flags: {
            boomerang: isBoomerang,
          },
        },
        (progress) => setConvertProgress(progress)
      );

      if (res?.src) {
        URL.revokeObjectURL(res.src);
      }
      setRes({
        src: URL.createObjectURL(r.file),
        type: r.type,
        name: r.name,
        size: r.file.size,
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

  const download = () => {
    // Create an invisible A element
    const a = document.createElement("a");
    a.style.display = "none";
    document.body.appendChild(a);

    // Set the HREF to a Blob representation of the data to be downloaded
    a.href = res?.src ?? "";

    // Use download attribute to set set desired file name
    a.setAttribute("download", res?.name ?? "");

    // Trigger the download by simulating click
    a.click();

    a.remove();
    // Cleanup
  };

  return (
    <div className="flex justify-start flex-col items-center min-h-screen w-screen py-2">
      <div>
        <Typography size="text-3xl" weight="font-bold" align="text-center">
          Video Clipping Tool V1.9!
        </Typography>
      </div>
      <div className="flex flex-col lg:flex-row py-2 px-4 w-full lg:h-full">
        <div className="flex flex-col p-2 w-full lg:w-4/5 justify-start xl:justify-between">
          <div className="xl:h-full flex flex-col flex-grow-0 xl:justify-center">
            <div className={`${video?.url ? "" : "hidden"}`}>
              <Typography size="text-xl" weight="font-bold" align="text-center">
                Source Video
              </Typography>
              <div className="relative">
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
                    className="w-full mb-2 "
                    onVolumeChange={(e) => {
                      setVolume((e.target as HTMLVideoElement).volume * 100);
                    }}
                    onTimeUpdate={(e) => {
                      setProgress((e.target as HTMLVideoElement).currentTime);
                    }}
                    onPlay={(e) => {
                      if (
                        (e.target as HTMLVideoElement).currentTime >= clip[1]
                      ) {
                        setProgress(clip[0]);
                        (e.target as HTMLVideoElement).currentTime = clip[0];
                      }
                    }}
                    autoPlay
                    // controls
                  ></video>
                </Cropper>
              </div>
            </div>
            <div
              className={`${
                video?.url ? "hidden" : ""
              } h-64 xl:h-full flex flex-col justify-center`}
            >
              <Typography align="text-center" weight="font-bold" size="text-lg">
                Please select a video
              </Typography>
            </div>
          </div>
          <div className="flex flex-col flex-grow-0 justify-center">
            <Typography align="text-center">
              {convertProgress &&
                `${convertProgress.message} ${
                  (convertProgress.ratio ?? 0) > 0
                    ? convertProgress.ratio + "%"
                    : ""
                }`}
            </Typography>
          </div>
          <div className="xl:h-full flex flex-col flex-grow-0 justify-center">
            {res?.src ? (
              <>
                <Typography
                  size="text-xl"
                  weight="font-bold"
                  align="text-center"
                >
                  Output
                </Typography>
                <div className="flex justify-center">
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
              </>
            ) : (
              <div className="h-64 xl:h-full flex flex-col justify-center">
                <Typography
                  align="text-center"
                  weight="font-bold"
                  size="text-lg"
                >
                  Press Convert to Generate Output
                </Typography>
              </div>
            )}
          </div>
        </div>
        <div className="flex grid gap-2 grid-cols-1 xl:grid-cols-2 w-full lg:w-4/5">
          <Section main>
            <Section sub>
              <div>
                <Button
                  color={mode === "youtube" ? "bg-blue-500" : "bg-blue-300"}
                  fontColor="text-white"
                  onClick={() => setMode("youtube")}
                  disabled={mode === "youtube"}
                >
                  Youtube Video
                </Button>
                <Button
                  color={mode === "upload" ? "bg-blue-500" : "bg-blue-300"}
                  fontColor="text-white"
                  onClick={() => setMode("upload")}
                  disabled={mode === "upload"}
                >
                  Local Video
                </Button>
              </div>
              {mode === "youtube" ? (
                <div>
                  <span className="text-lg font-bold mb-2">Enter URL</span>
                  <Textfield
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <div className="flex flex-column items-center">
                    <Button
                      color="bg-red-500"
                      fontColor="text-white"
                      onClick={() => getVidData()}
                    >
                      Get Video Data
                    </Button>
                    {videoRes.length > 0 && (
                      <div className="flex-shrink">
                        <Select
                          value={videoQuality}
                          onChange={(e) =>
                            setVideoQuality(Number(e.target.value))
                          }
                        >
                          {videoRes.map((e) => (
                            <option key={e.itag} value={e.itag}>
                              {e.quality}{" "}
                              {e.qualityLabel ? `(${e.qualityLabel})` : ""}{" "}
                              {e.hasVideo && "Video"} {e.hasAudio && "Audio"}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Typography weight="font-bold" size="text-lg">
                    Choose File
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="p-2 mr-2 rounded border w-full border-black block text-overflow-ellipsis overflow-hidden whitespace-nowrap"
                    accept="video/*, .mkv"
                  />
                  <Button
                    color="bg-red-500"
                    fontColor="text-white"
                    onClick={() => loadVideo()}
                  >
                    Load video
                  </Button>
                </div>
              )}
            </Section>
            <Section sub>
              <div className="flex flex-col mb-2">
                <Typography weight="font-bold" size="text-lg">
                  Progress
                </Typography>
                <Slider
                  step={0.01}
                  max={clip[1] ?? duration ?? 0}
                  min={clip[0] ?? 0}
                  value={roundToNDecimalPlaces(progress, 2)}
                  onChange={(e) => {
                    updateProgress(e);
                  }}
                />
                <div className="flex">
                  <Button
                    color="bg-blue-200"
                    onClick={() => {
                      setClip([progress, clip[1]]);
                    }}
                  >
                    Set Start
                  </Button>
                  <Button
                    color="bg-blue-200"
                    onClick={() => {
                      setClip([clip[0], progress]);
                    }}
                  >
                    Set End
                  </Button>
                </div>
              </div>
              <Typography weight="font-bold" size="text-lg">
                Trim
              </Typography>
              <div className="w-80 flex items-center mb-2">
                <div className="flex-shrink">
                  <NumberField
                    step=".01"
                    value={roundToNDecimalPlaces(clip[0], 2)}
                    min={0}
                    max={clip[1]}
                    onChange={(e) => {
                      updateProgress(Number(e.target.value));
                      setProgress(Number(e.target.value));
                      setClip([Number(e.target.value), clip[1]]);
                    }}
                  />
                </div>
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
                <div className="flex-shrink">
                  <NumberField
                    step=".01"
                    value={roundToNDecimalPlaces(clip[1], 2)}
                    min={clip[0]}
                    max={duration}
                    onChange={(e) => {
                      updateProgress(Number(e.target.value));
                      setClip([clip[0], Number(e.target.value)]);
                    }}
                  />
                </div>
              </div>
            </Section>
            <Section sub>
              <Button
                color="bg-blue-500"
                fontColor="text-white"
                onClick={() => setPlaying(!isPlaying)}
              >
                {!isPlaying ? "Play" : "Pause"}
              </Button>
              <Button
                color="bg-green-500"
                fontColor="text-white"
                onClick={() => setLoop(!loop)}
              >
                {!loop ? "No Loop" : "Loop"}
              </Button>
              <div className="flex flex-col">
                <Typography weight="font-bold" size="text-lg" type="h3">
                  Volume
                </Typography>
                <input
                  type="range"
                  max="100"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="p-2"
                />
              </div>
            </Section>
          </Section>
          <Section main>
            <Section sub>
              <div className="flex flex-col">
                <Typography weight="font-bold" size="text-lg" type="h3">
                  Fps
                </Typography>
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
                  <Button onClick={() => setResFps(10)}>10fps</Button>
                  <Button onClick={() => setResFps(15)}>15fps</Button>
                  <Button onClick={() => setResFps(21)}>21fps</Button>
                </div>
                <Typography weight="font-bold" size="text-lg" type="h3">
                  Scale
                </Typography>
                <div>
                  <Slider
                    step={0.01}
                    max={1}
                    min={0}
                    value={roundToNDecimalPlaces(resScale, 2)}
                    onChange={(e) => {
                      setResScale(e);
                    }}
                  />
                  <Button onClick={() => setResScale(1)}>100%</Button>
                  <Button onClick={() => setResScale(0.75)}>75%</Button>
                  <Button onClick={() => setResScale(0.5)}>50%</Button>
                  <Button onClick={() => setResScale(0.25)}>25%</Button>
                  {dimension.width > 0 && (
                    <Typography>
                      {dimension.width * resScale} x{" "}
                      {dimension.height * resScale} px
                    </Typography>
                  )}
                </div>
                <Typography weight="font-bold" size="text-lg" type="h3">
                  Speed
                </Typography>
                <div>
                  <Slider
                    step={0.01}
                    max={3}
                    min={0.1}
                    value={roundToNDecimalPlaces(speed, 2)}
                    onChange={(e) => {
                      setSpeed(e);
                    }}
                  />
                  <Button onClick={() => setSpeed(1)}>1x</Button>
                  <Button onClick={() => setSpeed(0.5)}>0.5x</Button>
                  <Button onClick={() => setSpeed(2)}>2x</Button>
                </div>
              </div>
              <div>
                <Typography weight="font-bold" size="text-lg" type="h3">
                  Crop
                </Typography>
                <div className="flex-row">
                  <Button
                    color="bg-blue-400"
                    onClick={() => setCropping((c) => !c)}
                  >
                    {isCropping ? "No Crop" : "Crop"}
                  </Button>
                  <Button
                    color="bg-red-400"
                    onClick={() => cropperRef.current.resetCrop()}
                  >
                    Reset Crop
                  </Button>
                </div>
              </div>
            </Section>
            <Section sub>
              <Typography weight="font-bold" size="text-lg" type="h3">
                Others
              </Typography>
              <div className="flex items-center">
                <Typography size="text-md" margin="mr-2">
                  Boomerang mode
                </Typography>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isBoomerang}
                  onChange={(e) => setBoomerang(e.target.checked)}
                />
              </div>
            </Section>
            <Section sub>
              <Typography weight="font-bold" size="text-lg" type="h3">
                Output
              </Typography>
              <div className="flex flex-row items-center mb-2">
                <span className="mr-2">Filename</span>
                <Textfield
                  value={outFilename}
                  placeholder={"Leave blank for default video title"}
                  onChange={(e) => setOutFilename(e.target.value)}
                />
              </div>
              <div className="flex flex-row items-center">
                <span className="mr-2">Extension</span>
                <div>
                  <Select
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
                  </Select>
                </div>
              </div>
            </Section>
            <Section sub>
              <Typography weight="font-bold" size="text-lg" type="h3">
                Convert
              </Typography>
              <Button
                color={!isFFMpegLoading ? "bg-blue-400" : "bg-gray-500"}
                onClick={convert}
                disabled={isFFMpegLoading}
              >
                Convert
              </Button>
              <Button
                color={res?.src ? "bg-blue-600" : "bg-gray-500"}
                onClick={download}
                disabled={!res?.src}
              >
                Download
              </Button>
              <Typography>
                {roundToNDecimalPlaces((res?.size ?? 0) / 1000000, 2)} MB (
                {dimension.width * resScale}x{dimension.height * resScale} px ,{" "}
                {fps} fps)
              </Typography>
            </Section>
          </Section>
        </div>
      </div>
    </div>
  );
};

export default App;
