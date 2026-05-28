import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS App Store: Bundle-ID in Xcode muss zu `appId` passen (Apple Developer → Identifiers).
 * Vor `npm run ios:prep`: Production-API in `.env.production` oder Build-Env:
 *   VITE_BILLING_API_URL=https://dein-server.tld
 */
const config: CapacitorConfig = {
  appId: 'com.allwin.app',
  appName: 'Clever Finance',
  webDir: 'dist',
};

export default config;
