# Google OAuth Setup Guide for TuitionTrack

To enable Google Login and Signup, you need to configure Google as an OAuth provider in your Supabase project.

## Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project dropdown and select **"New Project"**.
3. Name it **"TuitionTrack"** and click **"Create"**.

## Step 2: Configure OAuth Consent Screen
1. In the sidebar, go to **APIs & Services** > **OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in the required App information:
   - **App name**: TuitionTrack
   - **User support email**: (Your email)
   - **Developer contact info**: (Your email)
4. Click **Save and Continue** until you reach the dashboard.

## Step 3: Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Under **Authorized redirect URIs**, add this URL:
   `https://libtrkkntvvlywiqcock.supabase.co/auth/v1/callback`
5. Click **Create**.
6. **Copy** the **Client ID** and **Client Secret**.

## Step 4: Configure Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** > **Providers**.
3. Click on **Google** to expand its settings.
4. Toggle **Enable Google Provider** to **ON**.
5. Paste your **Client ID** and **Client Secret**.
6. Click **Save**.

---

## Technical Details
- **Redirect Path in Code**: `/auth/callback`
- **Supported Login**: Teachers (Parents/Students view-only)
