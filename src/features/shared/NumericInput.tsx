"use client";

import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { decimalString, parseDecimal } from "@/lib/decimal";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  value?: string | number;
  /** When set, normalize a valid value to this many decimal places when editing finishes. */
  decimalPlaces?: number;
  /** Receives the normalized numeric value after blur; callers persist this value. */
  onValueCommit?: (value: number) => void;
};

/** Keeps the field editable while its parent converts values for calculations. */
export function NumericInput({ value = "", onChange, onBlur, decimalPlaces, onValueCommit, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  const precision = decimalPlaces ?? (props.inputMode === "decimal" || String(props.step) === "0.1" ? 2 : undefined);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      inputMode={precision === undefined ? props.inputMode : "decimal"}
      step={precision === undefined ? props.step : 1 / (10 ** precision)}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        const parsed = precision === undefined ? undefined : parseDecimal(event.target.value);
        if (parsed !== undefined) {
          const normalized = decimalString(parsed, precision);
          event.target.value = normalized;
          setDraft(normalized);
          if (onValueCommit) onValueCommit(Number(normalized));
          else onChange?.(event as unknown as ChangeEvent<HTMLInputElement>);
        } else {
          setDraft(String(value));
        }
        onBlur?.(event);
      }}
    />
  );
}
