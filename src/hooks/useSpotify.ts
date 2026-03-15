import { useState, useEffect, useCallback } from 'react';

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function useSpotify() {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(() => {
    const saved = localStorage.getItem('spotify_tokens');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        const newTokens = event.data.tokens;
        setTokens(newTokens);
        localStorage.setItem('spotify_tokens', JSON.stringify(newTokens));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const login = useCallback(async () => {
    const response = await fetch('/api/auth/spotify/url');
    const { url } = await response.json();
    window.open(url, 'spotify_login', 'width=600,height=700');
  }, []);

  const playMusic = useCallback(async (genre: string) => {
    if (!tokens) return;
    try {
      // Simple implementation: search for a playlist and play it
      // This requires the user to have an active Spotify device
      const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${genre}&type=playlist&limit=1`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const searchData = await searchRes.json();
      const playlistUri = searchData.playlists.items[0]?.uri;

      if (playlistUri) {
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          body: JSON.stringify({ context_uri: playlistUri }),
          headers: { 
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.error('Spotify play error:', err);
    }
  }, [tokens]);

  return { tokens, login, playMusic };
}
