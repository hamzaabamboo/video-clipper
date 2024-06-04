import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { useEffect } from "react";

export interface Coordinate {
  x: number;
  y: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export const ASPECT_RATIOS = {
  square: [1, 1],
  fourThree: [4, 3],
  wide: [16, 8],
};

export const Cropper = forwardRef<
  any,
  {
    isCropping: boolean;
    onUpdateCrop: (position: Coordinate, dimension: Dimension) => void;
    children: React.ReactNode;
    aspectRatio?: keyof typeof ASPECT_RATIOS;
  }
>(({ isCropping, children, onUpdateCrop, aspectRatio }, ref) => {
  const cropPositionRef = useRef<Coordinate>({
    x: 0,
    y: 0,
  });
  const cropDimensionRef = useRef<Dimension>({
    width: 1,
    height: 1,
  });

  const cropperRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  function onMouseEnter(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const resetCrop = () => {
    cropDimensionRef.current.width = 1;
    cropPositionRef.current.x = 0;
    cropDimensionRef.current.height = 1;
    cropPositionRef.current.y = 0;

    updateCrop();
  };

  useImperativeHandle(ref, () => {
    return {
      resetCrop: () => {
        resetCrop();
      },
    };
  });

  const updateCrop = () => {
    const cropper = cropperRef.current as HTMLDivElement;
    const rect = parentRef.current?.getBoundingClientRect();

    cropper.style.width = cropDimensionRef.current.width * 100 + "%";
    cropper.style.left = cropPositionRef.current.x * (rect?.width ?? 0) + "px";
    cropper.style.height = cropDimensionRef.current.height * 100 + "%";
    cropper.style.top = cropPositionRef.current.y * (rect?.height ?? 0) + "px";

    onUpdateCrop(cropPositionRef.current, cropDimensionRef.current);
  };

  const handleDrag =
    (type: "pos" | "size" | "all") =>
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const target = event.nativeEvent.target as HTMLDivElement;
      let shiftX =
        event.nativeEvent.clientX - target.getBoundingClientRect().left;
      let shiftY =
        event.nativeEvent.clientY - target.getBoundingClientRect().top;
      event.nativeEvent.stopPropagation();
      event.nativeEvent.preventDefault();

      if (!parentRef.current) return;
      const t = parentRef.current as HTMLDivElement;

      const rect = t.getBoundingClientRect();

      function onMouseMove(event: MouseEvent) {
        if (type === "pos") {
          const x2 =
            cropPositionRef.current.x +
            rect.left * cropDimensionRef.current.width;
          const y2 =
            cropPositionRef.current.y +
            rect.top * cropDimensionRef.current.height;
          const xOff = event.clientX - shiftX - rect.left;
          const yOff = event.clientY - shiftY - rect.top;

          const cropper = cropperRef.current as HTMLDivElement;

          const xDim = (x2 - xOff) / rect.width;
          const yDim = (y2 - yOff) / rect.height;

          if (yOff > 0 && yOff < y2) {
            cropDimensionRef.current.height = yDim / rect.height;
            cropper.style.height = yDim * 100 + "%";
            cropPositionRef.current.y = yOff / rect.height;
            cropper.style.top = yOff + "px";
          }
          if (xOff > 0 && xOff < x2) {
            cropDimensionRef.current.width = xDim / rect.width;
            cropper.style.width = xDim * 100 + "%";
            cropPositionRef.current.x = xOff / rect.height;
            cropper.style.left = xOff + "px";
          }
        }
        if (type === "all") {
          const xOff = event.clientX - shiftX - rect.left;
          const yOff = event.clientY - shiftY - rect.top;
          const cropper = cropperRef.current as HTMLDivElement;
          if (
            yOff > 0 &&
            yOff + cropDimensionRef.current.height * rect.height < rect.height
          ) {
            cropPositionRef.current.y = yOff / rect.height;
            cropper.style.top = yOff + "px";
          }
          if (
            xOff > 0 &&
            xOff + cropDimensionRef.current.width * rect.width < rect.width
          ) {
            cropPositionRef.current.x = xOff / rect.width;
            cropper.style.left = xOff + "px";
          }
        }
        if (type === "size") {
          const xOff =
            event.clientX -
            rect.left -
            cropPositionRef.current.x * rect.width +
            event.movementX;
          const yOff =
            event.clientY -
            rect.top -
            cropPositionRef.current.y * rect.height +
            event.movementY;
          const cropper = cropperRef.current as HTMLDivElement;
          if (aspectRatio && aspectRatio in ASPECT_RATIOS) {
            const mag = Math.max(xOff, yOff);

            const factor =
              ASPECT_RATIOS[aspectRatio][1] / ASPECT_RATIOS[aspectRatio][0];
            const newHeight = mag / rect.height;
            const newWidth = mag / rect.width;
            if (
              newHeight + cropPositionRef.current.y > 1 ||
              newWidth + cropPositionRef.current.x > 1
            )
              return;
            cropDimensionRef.current.height = newHeight * factor;
            cropper.style.height = newHeight * factor * 100 + "%";
            cropDimensionRef.current.width = newWidth;
            cropper.style.width = newWidth * 100 + "%";
          } else {
            const xDim = xOff / rect.width;
            const yDim = yOff / rect.height;

            if (yOff > 0 && yOff < rect.height) {
              cropDimensionRef.current.height = yDim;
              cropper.style.height = yDim * 100 + "%";
            }
            if (xOff > 0 && xOff < rect.width) {
              cropDimensionRef.current.width = xDim;
              cropper.style.width = xDim * 100 + "%";
            }
          }
        }
      }

      // move the ball on mousemove
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseenter", onMouseEnter);

      target.onmouseleave = function () {
        console.log("upp!!!");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseenter", onMouseEnter);
        target.onmouseup = null;
        target.onmouseleave = null;
      };

      target.onmouseup = function () {
        console.log("upp!!!");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseenter", onMouseEnter);
        target.onmouseup = null;
        target.onmouseleave = null;
        updateCrop();
      };
    };

  useEffect(() => {
    if (!aspectRatio || !(aspectRatio in ASPECT_RATIOS)) return;
    const t = parentRef.current as HTMLDivElement;
    const rect = t.getBoundingClientRect();
    const { x, y } = cropPositionRef.current;
    const { width, height } = cropDimensionRef.current;
    const aspectFactor =
      ASPECT_RATIOS[aspectRatio][1] / ASPECT_RATIOS[aspectRatio][0];
    const expectedHeight = width * aspectFactor * rect.width;
    if (y + expectedHeight / rect.height < 1) {
      cropDimensionRef.current.height = expectedHeight / rect.height;
    } else {
      const expectWidth = (height / aspectFactor) * rect.height;
      cropDimensionRef.current.width = expectWidth / rect.width;
    }
    updateCrop();
  }, [aspectRatio]);
  return (
    <div
      ref={parentRef}
      className="relative mx-auto"
      style={{ width: "fit-content" }}
    >
      <div
        className="z-20 absolute"
        ref={cropperRef}
        style={{
          display: isCropping ? "block" : "none",
        }}
      >
        <div
          className="z-30 bg-gray-500 opacity-25 border border-black w-full h-full"
          draggable
          onMouseDown={handleDrag("all")}
          onDragStart={() => {
            return false;
          }}
        ></div>
        <div
          className="z-40 absolute bg-red-600 opacity-75 rounded-full w-8 h-8"
          style={{ top: "-1rem", left: "-1rem" }}
          draggable
          onMouseDown={handleDrag("pos")}
          onDragStart={() => {
            return false;
          }}
        ></div>
        <div
          className="z-40 absolute bg-red-600 opacity-75 rounded-full w-8 h-8"
          style={{ bottom: "-1rem", right: "-1rem" }}
          draggable
          onMouseDown={handleDrag("size")}
          onDragStart={() => {
            return false;
          }}
        ></div>
      </div>
      <div className="w-min">{children}</div>
    </div>
  );
});
