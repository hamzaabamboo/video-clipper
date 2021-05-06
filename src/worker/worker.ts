const ctx: Worker = self as any;

(ctx as any).importScripts("./ffmpeg-core.js");

ctx.onmessage = ({}) => {};
export {};
