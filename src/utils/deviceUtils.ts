/**
 * Device utility helpers for responsive and hardware detection.
 */

export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isMobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
      userAgent,
    );
  const isSmallScreen = window.innerWidth <= 768;
  const isTouchWithSmallViewport =
    ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth <= 1024;

  return isMobileUA || isSmallScreen || isTouchWithSmallViewport;
};
