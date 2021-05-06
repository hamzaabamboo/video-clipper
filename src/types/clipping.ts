import { MEDIA_TYPES } from "constants/mediaTypes";

export interface CroppingOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Duration {
  start?: number;
  end?: number;
}

export interface ClippingOptions {
  fps?: number;
  scale?: number;
  filename?: string;
  duration?: Duration;
  crop?: CroppingOptions;
  speed: number;
  flags?: Flags;
}

export interface Flags {
  boomerang?: boolean;
}
