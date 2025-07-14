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

export interface MetadataOptions {
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: File;
}

export interface ClippingOptions {
  fps?: number;
  scale?: number;
  filename?: string;
  duration?: Duration;
  crop?: CroppingOptions;
  speed: number;
  flags?: Flags;
  metadata?: MetadataOptions;
}

export interface Flags {
  boomerang?: boolean;
  fadeout?: boolean;
  loop?: boolean;
  optimizeGif?: boolean;
}
