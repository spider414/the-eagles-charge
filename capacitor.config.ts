import type { CapacitorConfig } from '@capacitor/cli';

// Production Capacitor configuration.
// The app loads the live web build from the production domain, so content
// and copy changes reach installed devices without a new Play Store release.
// Only native changes (icons, plugins, permissions) require a rebuild.
const config: CapacitorConfig = {
  appId: 'app.lovable.theeaglescharge',
  appName: 'HARMIC RECHARGE',
  webDir: 'dist',
  server: {
    url: 'https://recharge.harmicglobal.com',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#1a6b47',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a6b47',
    },
  },
};

export default config;