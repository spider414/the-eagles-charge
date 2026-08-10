import type { CapacitorConfig } from '@capacitor/cli';

// Production Capacitor configuration.
// The `server.url` hot-reload block has been removed so store builds
// load the bundled web assets from `dist/` instead of the sandbox.
const config: CapacitorConfig = {
  appId: 'app.lovable.theeaglescharge',
  appName: 'HARMIC RECHARGE',
  webDir: 'dist',
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