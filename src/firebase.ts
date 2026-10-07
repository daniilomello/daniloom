import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(
  app,
  (firebaseConfig as any).firestoreDatabaseId || "(default)",
);
export const storage = getStorage(app);

// Provider 1: Standard Google Auth + Drive permission
const driveProvider = new GoogleAuthProvider();
driveProvider.addScope("https://www.googleapis.com/auth/drive.file");
driveProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");
driveProvider.addScope("https://www.googleapis.com/auth/userinfo.email");

// Provider 2: YouTube Upload permission
// Note: Google OAuth forbids requesting youtube.upload AND drive.file in the exact same token request payload.
const youtubeProvider = new GoogleAuthProvider();
youtubeProvider.addScope("https://www.googleapis.com/auth/youtube.upload");
youtubeProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");
youtubeProvider.addScope("https://www.googleapis.com/auth/userinfo.email");

let isSigningIn = false;

async function authorizeGoogle(provider: GoogleAuthProvider, scope: 'drive' | 'youtube') {
  if (!window.daniloomDesktop) return signInWithPopup(auth, provider);
  const { accessToken } = await window.daniloomDesktop.authorize(scope);
  const credential = GoogleAuthProvider.credential(null, accessToken);
  const result = await signInWithCredential(auth, credential);
  // signInWithCredential does not always retain the provider OAuth token in the result.
  return { result, accessToken };
}

async function signInGoogle(provider: GoogleAuthProvider, scope: 'drive' | 'youtube') {
  const authorization = await authorizeGoogle(provider, scope);
  if ('result' in authorization) return authorization;
  return { result: authorization, accessToken: GoogleAuthProvider.credentialFromResult(authorization)?.accessToken };
}
let cachedAccessToken: string | null =
  typeof window !== "undefined"
    ? localStorage.getItem("google_access_token")
    : null;
let cachedAccessTokenExpiresAt: number | null =
  typeof window !== "undefined"
    ? Number(localStorage.getItem("google_access_token_expires_at")) || null
    : null;
let cachedYouTubeAccessToken: string | null =
  typeof window !== "undefined"
    ? localStorage.getItem("youtube_access_token")
    : null;

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== "undefined") {
        cachedAccessToken = localStorage.getItem("google_access_token");
      }
      if (!cachedAccessTokenExpiresAt && typeof window !== "undefined") {
        const storedExpiresAt = localStorage.getItem(
          "google_access_token_expires_at",
        );
        cachedAccessTokenExpiresAt = storedExpiresAt
          ? Number(storedExpiresAt) || null
          : null;
      }
      if (!cachedYouTubeAccessToken && typeof window !== "undefined") {
        cachedYouTubeAccessToken = localStorage.getItem("youtube_access_token");
      }
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      cachedAccessTokenExpiresAt = null;
      cachedYouTubeAccessToken = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("google_access_token");
        localStorage.removeItem("google_access_token_expires_at");
        localStorage.removeItem("youtube_access_token");
        window.dispatchEvent(
          new CustomEvent("daniloom_drive_token_expired", {
            detail: { reason: "logged_out" },
          }),
        );
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (triggered by user click) - Primary Login & Drive Access
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const { result, accessToken } = await signInGoogle(driveProvider, 'drive');
    const credential = { accessToken };
    if (!credential?.accessToken) {
      throw new Error(
        "Não foi possível obter o token de acesso da conta Google.",
      );
    }

    cachedAccessToken = credential.accessToken;
    // Google OAuth access tokens are valid for 3600s (1h). We set margin to 59 minutes (3540s).
    const expiresAt = Date.now() + 3540 * 1000;
    cachedAccessTokenExpiresAt = expiresAt;

    if (typeof window !== "undefined") {
      localStorage.setItem("google_access_token", cachedAccessToken);
      localStorage.setItem("google_access_token_expires_at", String(expiresAt));
      window.dispatchEvent(
        new CustomEvent("daniloom_drive_token_renewed", {
          detail: { token: cachedAccessToken, expiresAt },
        }),
      );
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Renews the Google Drive access token without signing out of Firebase Auth.
export const renewGoogleDriveToken = async (): Promise<{
  token: string;
  expiresAt: number;
} | null> => {
  try {
    isSigningIn = true;
    // Use signInWithPopup with driveProvider to retrieve a fresh OAuth 2.0 access token
    const { result, accessToken } = await signInGoogle(driveProvider, 'drive');
    const credential = { accessToken };
    if (!credential?.accessToken) {
      throw new Error(
        "Não foi possível renovar o token de acesso do Google Drive.",
      );
    }

    cachedAccessToken = credential.accessToken;
    const expiresAt = Date.now() + 3540 * 1000;
    cachedAccessTokenExpiresAt = expiresAt;

    if (typeof window !== "undefined") {
      localStorage.setItem("google_access_token", cachedAccessToken);
      localStorage.setItem("google_access_token_expires_at", String(expiresAt));
      window.dispatchEvent(
        new CustomEvent("daniloom_drive_token_renewed", {
          detail: { token: cachedAccessToken, expiresAt },
        }),
      );
    }
    return { token: cachedAccessToken, expiresAt };
  } catch (error: any) {
    console.error("Erro ao renovar autorização do Google Drive:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleTokenExpiresAt = (): number | null => {
  if (!cachedAccessTokenExpiresAt && typeof window !== "undefined") {
    const stored = localStorage.getItem("google_access_token_expires_at");
    cachedAccessTokenExpiresAt = stored ? Number(stored) || null : null;
  }
  return cachedAccessTokenExpiresAt;
};

export const isGoogleTokenExpired = (): boolean => {
  const token =
    typeof window !== "undefined"
      ? cachedAccessToken || localStorage.getItem("google_access_token")
      : cachedAccessToken;
  if (!token) return true;

  const expiresAt = getGoogleTokenExpiresAt();
  if (expiresAt) {
    // Expired if current time exceeds expiration minus 30 seconds cushion
    return Date.now() >= expiresAt - 30 * 1000;
  }
  return false;
};

export const getGoogleTokenRemainingMinutes = (): number => {
  const token =
    typeof window !== "undefined"
      ? cachedAccessToken || localStorage.getItem("google_access_token")
      : cachedAccessToken;
  if (!token) return -1;

  const expiresAt = getGoogleTokenExpiresAt();
  if (!expiresAt) return 60;

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (60 * 1000));
};

export const clearGoogleDriveToken = () => {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_access_token_expires_at");
    window.dispatchEvent(
      new CustomEvent("daniloom_drive_token_expired", {
        detail: { reason: "cleared" },
      }),
    );
  }
};

// Sign in / authorize for YouTube
export const googleSignInForYouTube = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const { result, accessToken } = await signInGoogle(youtubeProvider, 'youtube');
    const credential = { accessToken };
    if (!credential?.accessToken) {
      throw new Error("Não foi possível obter o token de acesso do YouTube.");
    }

    cachedYouTubeAccessToken = credential.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("youtube_access_token", cachedYouTubeAccessToken);
    }
    return { user: result.user, accessToken: cachedYouTubeAccessToken };
  } catch (error: any) {
    console.error("YouTube authorization error:", error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== "undefined") {
    cachedAccessToken = localStorage.getItem("google_access_token");
  }
  return cachedAccessToken;
};

export const getYouTubeAccessToken = async (): Promise<string | null> => {
  if (!cachedYouTubeAccessToken && typeof window !== "undefined") {
    cachedYouTubeAccessToken = localStorage.getItem("youtube_access_token");
  }
  return cachedYouTubeAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedYouTubeAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.clear();
    sessionStorage.clear();
  }
};
