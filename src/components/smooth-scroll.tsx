"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable smooth scroll on app surfaces that use internal scrolling containers.
    if (!pathname || pathname.startsWith('/dashboard') || pathname.startsWith('/review') || pathname.startsWith('/r/')) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
