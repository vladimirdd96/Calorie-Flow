"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  value?: string | number;
};

/** Keeps the field editable while its parent converts values for calculations. */
export function NumericInput({ value = "", onChange, onBlur, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        setDraft(String(value));
        onBlur?.(event);
      }}
    />
  );
}
