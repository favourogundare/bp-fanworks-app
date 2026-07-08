import { useEffect, useState } from "react";

// Layout breakpoints for the responsive shell. Desktop keeps the original
// (unchanged) layout; phone/tablet swap a few inline style objects.
export type Breakpoint = "phone" | "tablet" | "desktop";

const PHONE_MAX = 639;   // phone: < 640px
const TABLET_MAX = 1023; // tablet: 640–1023px; desktop: >= 1024px

function read(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= PHONE_MAX) return "phone";
  if (w <= TABLET_MAX) return "tablet";
  return "desktop";
}

// Returns the current layout breakpoint and re-renders on changes.
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read);
  useEffect(() => {
    const onResize = () => setBp(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return bp;
}
