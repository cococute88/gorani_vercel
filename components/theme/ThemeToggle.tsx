"use client";

import { Moon, Sun } from "lucide-react";
import {
  useResolvedTheme,
  useTheme,
  type ResolvedTheme,
} from "@/components/theme/ThemeProvider";

const OPTIONS: { value: ResolvedTheme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "라이트", Icon: Sun },
  { value: "dark", label: "다크", Icon: Moon },
];

/**
 * Compact two-option (light / dark) segmented selector for the top header.
 * The system/monitor option was removed per THEME-2: users only ever pick a
 * concrete theme. `ThemeProvider` still understands a stored "system" value
 * for backwards compatibility, but as soon as the user clicks here only
 * "light" or "dark" is persisted.
 *
 * Styling adapts to the resolved theme so the control stays readable on both
 * the light (white) and dark header bars.
 */
export default function ThemeToggle() {
  const { preference, theme, setPreference } = useTheme();
  const resolved = useResolvedTheme();
  const isLight = resolved === "light";

  // When the stored preference is still "system", highlight whichever concrete
  // theme it currently resolves to so the active state never looks empty.
  const activeValue: ResolvedTheme = preference === "system" ? theme : preference;

  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={`flex shrink-0 items-center gap-0.5 rounded-md border p-0.5 ${
        isLight
          ? "border-slate-200 bg-slate-100"
          : "border-white/10 bg-white/5"
      }`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = activeValue === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : isLight
                  ? "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
