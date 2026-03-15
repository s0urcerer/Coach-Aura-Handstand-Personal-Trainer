import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LiveAPI } from './services/liveApi';
import { useHeartRate } from './hooks/useHeartRate';
import { useSpotify } from './hooks/useSpotify';
import { Activity, Camera, Music, Heart, Play, Square, Settings, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYSTEM_INSTRUCTION = `
You are Aura, a world-class handstand coach. Your goal is to help the user achieve a 30-second handstand hold.
You have access to their video feed and heart rate data.
Your personality is encouraging, technical, and precise.

Guidelines:
1. Watch their form carefully. Critique their shoulder engagement, core tension, and finger grip (the "spider grip").
2. Use their heart rate to gauge intensity. If it's too high, tell them to rest. If it's low, push them harder.
3. You can control their music. If they need to focus, suggest "lo-fi" or "ambient". If they need energy for a max hold, suggest "high-energy electronic" or "rock".
4. Give specific drills: Wall walks, chest-to-wall holds, kick-up practice, and freestanding attempts.
5. Motivate them! Celebrate small wins.

When you want to change the music, say something like "I'm switching the music to [genre] to help you focus."
`;

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveApiRef = useRef<LiveAPI | null>(null);
  
  const { heartRate, isConnected: isHrConnected, connect: connectHr } = useHeartRate();
  const { tokens: spotifyTokens, login: loginSpotify, playMusic } = useSpotify();

  const startCoaching = useCallback(async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      liveApiRef.current = new LiveAPI(apiKey);
      await liveApiRef.current.connect({
        systemInstruction: SYSTEM_INSTRUCTION,
        onMessage: (msg) => {
          if (msg.serverContent?.modelTurn?.parts[0]?.text) {
            const text = msg.serverContent.modelTurn.parts[0].text;
            setCoachMessage(text);
            
            // Simple logic to detect music suggestions in text
            if (text.toLowerCase().includes("switching the music to")) {
              const match = text.match(/switching the music to ([\w\s-]+)/i);
              if (match) playMusic(match[1]);
            }
          }
        }
      });

      setIsStarted(true);
    } catch (err) {
      console.error("Failed to start:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [playMusic]);

  const stopCoaching = useCallback(() => {
    liveApiRef.current?.disconnect();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsStarted(false);
  }, []);

  // Frame capture loop
  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(() => {
      if (videoRef.current && canvasRef.current && liveApiRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          liveApiRef.current.sendVideoFrame(base64);
          
          // Periodically send heart rate as text context if needed, 
          // but Live API usually handles audio/vision. 
          // For now, we rely on the coach "seeing" the HR on screen or we could send it via audio if we had user TTS.
          // Better: The coach can see the HR if we overlay it on the video we send.
        }
      }
    }, 1000); // 1 FPS for vision is usually enough for form critique

    return () => clearInterval(interval);
  }, [isStarted]);

  return (
    <div className="min-h-screen bg-[#151619] text-white font-mono selection:bg-emerald-500/30">
      {/* Header / Hardware Rail */}
      <header className="border-b border-white/10 p-4 flex items-center justify-between bg-[#1a1b1e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-sm flex items-center justify-center">
            <Zap className="w-5 h-5 text-black fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">Aura v1.0</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-tighter">Multimodal Coaching System</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <StatusItem 
            label="Heart Rate" 
            value={heartRate ? `${heartRate} BPM` : (isConnecting ? "CONNECTING..." : "OFFLINE (CLICK TO CONNECT)")} 
            active={isHrConnected}
            onClick={connectHr}
          />
          <StatusItem 
            label="Spotify" 
            value={spotifyTokens ? "CONNECTED" : "DISCONNECTED"} 
            active={!!spotifyTokens}
            onClick={loginSpotify}
          />
          <div className="h-8 w-[1px] bg-white/10 mx-2" />
          <button 
            onClick={isStarted ? stopCoaching : startCoaching}
            disabled={isConnecting}
            className={cn(
              "px-6 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-all",
              isStarted 
                ? "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white" 
                : "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
            )}
          >
            {isConnecting ? "Initializing..." : isStarted ? "Terminate Session" : "Initialize Coach"}
          </button>
        </div>
      </header>

      <main className="p-6 grid grid-cols-12 gap-6 max-w-[1600px] mx-auto">
        {/* Left Column: Vision & Stats */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Main Vision Feed */}
          <div className="relative aspect-video bg-black rounded-xl border border-white/5 overflow-hidden group shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover opacity-80 grayscale-[0.2]"
            />
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            
            {/* Overlay Grid */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent">
              <div className="w-full h-full border border-white/5 grid grid-cols-3 grid-rows-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border-[0.5px] border-white/5" />
                ))}
              </div>
            </div>

            {/* HUD Elements */}
            <div className="absolute top-6 left-6 flex flex-col gap-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-sm flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", isStarted ? "bg-red-500" : "bg-white/20")} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Live Vision Feed</span>
              </div>
              {heartRate && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-sm flex items-center gap-3"
                >
                  <Heart className="w-3 h-3 text-red-500 fill-current" />
                  <span className="text-xl font-bold tracking-tighter">{heartRate}</span>
                  <span className="text-[8px] text-white/40 uppercase">BPM</span>
                </motion.div>
              )}
            </div>

            {!isStarted && !isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8 text-white/40" />
                  </div>
                  <p className="text-xs text-white/60 uppercase tracking-[0.2em]">Awaiting Optical Input</p>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Stats Rail */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Session Time" value="00:00:00" icon={Activity} />
            <StatCard label="Form Accuracy" value="--" icon={Settings} />
            <StatCard label="Hold Record" value="0s" icon={ChevronRight} />
          </div>
        </div>

        {/* Right Column: Coach & Program */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Coach Feedback */}
          <div className="bg-[#1a1b1e] border border-white/10 rounded-xl p-6 flex flex-col h-[500px] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Coach Aura</h2>
              </div>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1 h-4 bg-white/10 rounded-full" />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {coachMessage ? (
                  <motion.div
                    key={coachMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm leading-relaxed text-white/80 font-sans italic"
                  >
                    "{coachMessage}"
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                    <Activity className="w-12 h-12" />
                    <p className="text-[10px] uppercase tracking-widest">Awaiting Coach Transmission</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 text-[10px] text-white/40 uppercase tracking-widest">
                <div className="flex-1 h-[1px] bg-white/5" />
                <span>System Status: Nominal</span>
                <div className="flex-1 h-[1px] bg-white/5" />
              </div>
            </div>
          </div>

          {/* Program Progress */}
          <div className="bg-[#1a1b1e] border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-emerald-500" />
              Handstand Mastery
            </h2>
            <div className="space-y-3">
              <ProgressItem label="Shoulder Mobility" progress={65} />
              <ProgressItem label="Core Stability" progress={40} />
              <ProgressItem label="Balance Control" progress={12} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Music Rail */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-sm flex items-center justify-center">
              <Music className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Current Vibe</p>
              <p className="text-xs font-bold">Aura's Selection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500"
                  animate={{ width: isStarted ? "100%" : "0%" }}
                  transition={{ duration: 30, ease: "linear" }}
                />
              </div>
              <span className="text-[10px] text-white/40 font-mono">00:30</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-white/40 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusItem({ label, value, active, onClick }: { label: string, value: string, active: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-left group cursor-pointer"
    >
      <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5 group-hover:text-white/50 transition-colors">{label}</p>
      <div className="flex items-center gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-white/10")} />
        <span className={cn("text-[10px] font-bold tracking-tighter", active ? "text-white" : "text-white/40")}>{value}</span>
      </div>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-[#1a1b1e] border border-white/10 rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-white/40" />
      </div>
      <div>
        <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-lg font-bold tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function ProgressItem({ label, progress }: { label: string, progress: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase tracking-widest">
        <span className="text-white/60">{label}</span>
        <span className="text-emerald-500 font-bold">{progress}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-emerald-500/50"
        />
      </div>
    </div>
  );
}
