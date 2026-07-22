"use client";

import { X } from "lucide-react";
import { useRef, type InputHTMLAttributes } from "react";

type ClearableInputProps = InputHTMLAttributes<HTMLInputElement> & {
  onClear: () => void;
  clearLabel?: string;
};

/** Adds a compact, keyboard-accessible clear action without changing form semantics. */
export function ClearableInput({ onClear, clearLabel = "Clear input", value, className, ...props }: ClearableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value !== undefined && String(value).length > 0;

  return (
    <span className="clearable-input">
      <input ref={inputRef} {...props} value={value} className={className} />
      {hasValue && (
        <button
          type="button"
          className="clearable-input-button"
          aria-label={clearLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
