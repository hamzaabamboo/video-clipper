import React, { forwardRef, useImperativeHandle, useRef } from "react";

export interface Coordinate {
  x: number;
  y: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export const Cropper = forwardRef<
  any,
  {
    isCropping: boolean;
    onUpdateCrop: (position: Coordinate, dimension: Dimension) => void;
    children: React.ReactNode;
  }
>(({ isCropping, children, onUpdateCrop }, ref) => {
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

  const handleDrag = (type: "pos" | "size" | "all") => (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const target = event.nativeEvent.target as HTMLDivElement;
    let shiftX =
      event.nativeEvent.clientX - target.getBoundingClientRect().left;
    let shiftY = event.nativeEvent.clientY - target.getBoundingClientRect().top;
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
        const xDim = xOff / rect.width;
        const yDim = yOff / rect.height;
        console.log(xDim, yDim);
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

  return (
    <div ref={parentRef} className="relative">
      <div
        className="absolute z-20"
        ref={cropperRef}
        style={{
          display: isCropping ? "block" : "none",
        }}
      >
        <div
          className="bg-gray-500 w-full h-full opacity-25 z-30"
          draggable
          onMouseDown={handleDrag("all")}
          onDragStart={() => {
            return false;
          }}
        ></div>
        <div
          className="w-8 h-8 rounded-full bg-red-600 opacity-75 absolute z-40"
          style={{ top: "-1rem", left: "-1rem" }}
          draggable
          onMouseDown={handleDrag("pos")}
          onDragStart={() => {
            return false;
          }}
        ></div>
        <div
          className="w-8 h-8 rounded-full bg-red-600 opacity-75 absolute z-40"
          style={{ bottom: "-1rem", right: "-1rem" }}
          draggable
          onMouseDown={handleDrag("size")}
          onDragStart={() => {
            return false;
          }}
        ></div>
      </div>
      <div>{children}</div>
    </div>
  );
});
