import { useState, useEffect, useCallback } from "react";
import {
  getAccessToken,
  getGoogleTokenExpiresAt,
  getGoogleTokenRemainingMinutes,
  isGoogleTokenExpired,
  renewGoogleDriveToken,
} from "../firebase";

export interface UseDriveTokenStatusReturn {
  hasToken: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  remainingMinutes: number;
  expiresAt: number | null;
  isRenewing: boolean;
  is401Detected: boolean;
  renewToken: () => Promise<boolean>;
  clear401: () => void;
}

/**
 * Hook para monitorar e renovar o token de acesso do Google Drive.
 * Lida com contagem regressiva, avisos de expiração iminente e interceptação de 401.
 */
export const useDriveTokenStatus = (): UseDriveTokenStatusReturn => {
  const [hasToken, setHasToken] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("google_access_token");
  });
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    getGoogleTokenExpiresAt(),
  );
  const [remainingMinutes, setRemainingMinutes] = useState<number>(() =>
    getGoogleTokenRemainingMinutes(),
  );
  const [isExpired, setIsExpired] = useState<boolean>(() =>
    isGoogleTokenExpired(),
  );
  const [isExpiringSoon, setIsExpiringSoon] = useState<boolean>(() => {
    const mins = getGoogleTokenRemainingMinutes();
    return mins > 0 && mins <= 10;
  });
  const [isRenewing, setIsRenewing] = useState<boolean>(false);
  const [is401Detected, setIs401Detected] = useState<boolean>(false);

  const updateStatus = useCallback(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("google_access_token")
        : null;
    const exists = !!token;
    setHasToken(exists);

    if (!exists) {
      setExpiresAt(null);
      setRemainingMinutes(-1);
      setIsExpired(true);
      setIsExpiringSoon(false);
      return;
    }

    const expAt = getGoogleTokenExpiresAt();
    setExpiresAt(expAt);

    const mins = getGoogleTokenRemainingMinutes();
    setRemainingMinutes(mins);

    const expired = isGoogleTokenExpired();
    setIsExpired(expired);
    setIsExpiringSoon(!expired && mins > 0 && mins <= 10);
  }, []);

  // Intervalo regular de 15 segundos para atualizar a contagem de minutos e expiração
  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 15000);
    return () => clearInterval(interval);
  }, [updateStatus]);

  // Escuta eventos globais disparados pelo firebase.ts e drive.ts
  useEffect(() => {
    const handleTokenRenewed = (e: any) => {
      setIs401Detected(false);
      if (e.detail?.expiresAt) {
        setExpiresAt(e.detail.expiresAt);
      }
      updateStatus();
    };

    const handleTokenExpired = () => {
      setIsExpired(true);
      setRemainingMinutes(0);
      setIsExpiringSoon(false);
      updateStatus();
    };

    const handle401Detected = () => {
      setIs401Detected(true);
      setIsExpired(true);
      setRemainingMinutes(0);
      setIsExpiringSoon(false);
    };

    window.addEventListener("daniloom_drive_token_renewed", handleTokenRenewed);
    window.addEventListener("daniloom_drive_token_expired", handleTokenExpired);
    window.addEventListener("daniloom_drive_401_detected", handle401Detected);

    return () => {
      window.removeEventListener(
        "daniloom_drive_token_renewed",
        handleTokenRenewed,
      );
      window.removeEventListener(
        "daniloom_drive_token_expired",
        handleTokenExpired,
      );
      window.removeEventListener(
        "daniloom_drive_401_detected",
        handle401Detected,
      );
    };
  }, [updateStatus]);

  const clear401 = useCallback(() => {
    setIs401Detected(false);
  }, []);

  const renewToken = useCallback(async (): Promise<boolean> => {
    try {
      setIsRenewing(true);
      const res = await renewGoogleDriveToken();
      if (res?.token) {
        setIs401Detected(false);
        updateStatus();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Falha ao renovar autorização do Google Drive:", err);
      return false;
    } finally {
      setIsRenewing(false);
    }
  }, [updateStatus]);

  return {
    hasToken,
    isExpired: isExpired || is401Detected,
    isExpiringSoon,
    remainingMinutes,
    expiresAt,
    isRenewing,
    is401Detected,
    renewToken,
    clear401,
  };
};
