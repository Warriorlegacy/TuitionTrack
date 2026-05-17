import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuitiontrack.app',
  appName: 'TuitionTrack',
  webDir: 'public',
  server: {
    // This points the native app to the live web app deployment.
    // Replace with your actual Vercel production URL.
    url: 'https://tuitiontrack-app.vercel.app',
    cleartext: true
  }
};

export default config;
