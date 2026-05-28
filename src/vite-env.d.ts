/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILLING_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  /** Set to "0" or "false" to disable. In dev, Elite is forced unless disabled. */
  readonly VITE_DEV_FORCE_ELITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
