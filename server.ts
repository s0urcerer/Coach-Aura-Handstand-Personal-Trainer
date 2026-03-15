import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import SpotifyWebApi from "spotify-web-api-node";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: `${process.env.APP_URL}/auth/spotify/callback`,
  });

  app.use(express.json());

  // Spotify Auth Routes
  app.get("/api/auth/spotify/url", (req, res) => {
    const scopes = ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "state");
    res.json({ url: authorizeURL });
  });

  app.get("/auth/spotify/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const data = await spotifyApi.authorizationCodeGrant(code as string);
      const { access_token, refresh_token, expires_in } = data.body;
      
      // In a real app, we'd store these in a session or DB.
      // For this demo, we'll send them back to the client via postMessage.
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'SPOTIFY_AUTH_SUCCESS',
                  tokens: ${JSON.stringify({ access_token, refresh_token, expires_in })}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Spotify Auth Error:", err);
      res.status(500).send("Authentication failed");
    }
  });

  // Proxy for Spotify API calls (to avoid exposing client secret if needed, 
  // but client-side token is usually enough for playback control)
  app.post("/api/spotify/refresh", async (req, res) => {
    const { refresh_token } = req.body;
    try {
      spotifyApi.setRefreshToken(refresh_token);
      const data = await spotifyApi.refreshAccessToken();
      res.json(data.body);
    } catch (err) {
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
