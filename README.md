# Aura: AI Handstand Coach

Aura is a real-time, multimodal AI coach designed to help users achieve a 30-second handstand hold. It leverages the **Gemini Live API** to provide instant form critique, motivational coaching, and biometric-aware training.

## 🚀 Features

- **Real-time Form Critique**: Uses the Gemini 2.5 Flash Live model to analyze video frames and provide immediate feedback on shoulder engagement, core tension, and balance.
- **Biometric Integration**: Connects to heart rate monitors via Web Bluetooth. Aura monitors your intensity and suggests rest periods if your heart rate spikes.
- **Dynamic Music Control**: Integrated with the Spotify API. Aura selects music genres (e.g., Lo-fi for focus, High-energy for max holds) based on your current training state.
- **Multimodal Interaction**: Natural voice conversation that can be interrupted, combined with real-time vision processing.

## 🛠️ Tech Stack

- **Frontend**: React 19, Tailwind CSS, Lucide React, Motion.
- **Backend**: Node.js (Express) for Spotify OAuth and API proxying.
- **AI**: Google GenAI SDK (@google/genai) using `gemini-2.5-flash-native-audio-preview-09-2025`.
- **APIs**: Spotify Web API, Web Bluetooth API (Heart Rate Profile).
- **Deployment**: Google Cloud Run.

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- A Google AI Studio API Key
- A Spotify Developer Account

### Steps

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd aura-handstand-coach
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   SPOTIFY_CLIENT_ID=your_spotify_id
   SPOTIFY_CLIENT_SECRET=your_spotify_secret
   APP_URL=http://localhost:3000
   ```

4. **Spotify Setup**:
   - Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   - Add `http://localhost:3000/auth/spotify/callback` to your Redirect URIs.

5. **Run the app**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 🏗️ Architecture

1. **Client**: React app captures video/audio and heart rate data.
2. **Gemini Live API**: Processes multimodal input and streams back audio/text responses.
3. **Express Server**: Handles Spotify OAuth flow and token management.
4. **Spotify API**: Controls music playback based on AI instructions.

## 🤖 Automated Deployment (Bonus Points)

This project includes a `cloudbuild.yaml` file that automates the CI/CD pipeline on Google Cloud. 
- **Link to Code**: [cloudbuild.yaml](./cloudbuild.yaml)
- **Process**: When code is pushed, Google Cloud Build automatically builds the Docker container, pushes it to the Google Container Registry, and deploys the new version to Google Cloud Run.

## 💡 Learnings

Working with the Gemini Live API highlighted the power of low-latency multimodal feedback. Synchronizing audio streams and vision frames in a web environment requires careful buffer management, but the result is a coaching experience that feels truly human and responsive.
