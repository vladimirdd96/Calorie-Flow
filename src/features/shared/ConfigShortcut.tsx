"use client";

import { SlidersHorizontal } from "lucide-react";

export function ConfigShortcut({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="config-shortcut" aria-label={label} onClick={onClick}><SlidersHorizontal /></button>;
}
