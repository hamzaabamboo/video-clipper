import React from "react";
import { FCWithChildren } from "src/types/FCWithChildren";
import { NumberField } from "./NumberField";

interface SliderProps {
  value?: number;
  min?: number | string;
  max?: number | string;
  step?: number;
  onChange: (val: number) => void;
}

export const Slider: FCWithChildren<SliderProps> = ({
  value,
  min,
  max,
  onChange,
  step = 0.01,
}) => {
  return (
    <div className="flex mb-2">
      <div className="flex-shrink pr-2">
        <NumberField
          step={step}
          max={max}
          min={min}
          value={value}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
        />
      </div>
      <input
        type="range"
        step=".01"
        className="flex-grow p-2 w-full"
        max={max}
        min={min}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
};
