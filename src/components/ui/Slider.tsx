import React, { forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface SliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "size"
  > {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  thumbClassName?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      orientation = "horizontal",
      className,
      trackClassName,
      fillClassName,
      thumbClassName,
      id,
      name,
      title,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      ...restProps
    },
    ref,
  ) => {
    const isVertical = orientation === "vertical";
    const minVal = Number(min);
    const maxVal = Number(max);
    const stepVal = Number(step);

    const safeValue = Number.isFinite(value) ? value : minVal;
    const clampedValue = Math.min(Math.max(safeValue, minVal), maxVal);

    const range = maxVal - minVal;
    const percentage =
      range <= 0
        ? 0
        : Math.max(0, Math.min(100, ((clampedValue - minVal) / range) * 100));

    // Thumb diameter is 14px (0.875rem = 14px), radius is 7px.
    // Thumb center moves from 7px to (100% - 7px) so its outer circle never overflows the track edges.
    const thumbOffset = `calc(${percentage}% * (1 - 14px / 100%) + 7px)`;
    const fillDimension =
      percentage <= 0
        ? "0%"
        : percentage >= 100
          ? "100%"
          : `calc(${percentage}% * (1 - 14px / 100%) + 7px)`;

    return (
      <div
        className={cn(
          "relative flex items-center select-none group touch-none",
          isVertical ? "flex-col justify-center h-full w-5" : "w-full h-5",
          disabled && "opacity-40 pointer-events-none",
          className,
        )}
      >
        {/* Track */}
        <div
          className={cn(
            "relative rounded-full bg-muted border border-line/40 transition-colors",
            isVertical ? "w-1.5 h-full" : "w-full h-1.5",
            trackClassName,
          )}
        >
          {/* Active Filled Track */}
          <div
            className={cn(
              "absolute rounded-full bg-primary/45 transition-all duration-75",
              isVertical ? "bottom-0 left-0 right-0" : "left-0 top-0 bottom-0",
              fillClassName,
            )}
            style={
              isVertical
                ? { height: fillDimension }
                : { width: fillDimension }
            }
          />
        </div>

        {/* Thumb Knob */}
        <div
          className={cn(
            "absolute rounded-full bg-primary pointer-events-none z-10 transition-transform duration-100 ease-out shadow-xs",
            "w-3.5 h-3.5",
            "group-hover:scale-115 group-active:scale-95",
            "group-focus-within:ring-2 group-focus-within:ring-primary group-focus-within:ring-offset-2 group-focus-within:ring-offset-app",
            thumbClassName,
          )}
          style={
            isVertical
              ? {
                  bottom: thumbOffset,
                  left: "50%",
                  transform: "translate(-50%, 50%)",
                }
              : {
                  left: thumbOffset,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }
          }
          aria-hidden="true"
        />

        {/* Native range input for accessible interaction */}
        <input
          ref={ref}
          type="range"
          id={id}
          name={name}
          min={minVal}
          max={maxVal}
          step={stepVal}
          value={clampedValue}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          title={title}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-valuenow={clampedValue}
          aria-valuemin={minVal}
          aria-valuemax={maxVal}
          style={
            isVertical
              ? ({
                  writingMode: "bt-lr",
                  WebkitAppearance: "slider-vertical",
                } as any)
              : undefined
          }
          className={cn(
            "absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20 m-0 p-0",
          )}
          {...restProps}
        />
      </div>
    );
  },
);

Slider.displayName = "Slider";
