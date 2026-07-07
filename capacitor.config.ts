import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.01d5208ddc1349b3a8eda8a5e2037792',
  appName: 'the-eagles-charge',
  webDir: 'dist',
  server: {
    url: 'https://01d5208d-dc13-49b3-a8ed-a8a5e2037792.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;