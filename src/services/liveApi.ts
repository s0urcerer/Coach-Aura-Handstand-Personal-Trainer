import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export class LiveAPI {
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor(private apiKey: string) {}

  async connect(config: {
    systemInstruction?: string;
    onMessage?: (message: LiveServerMessage) => void;
    onInterrupted?: () => void;
  }) {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    
    this.session = await ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: config.systemInstruction,
      },
      callbacks: {
        onopen: () => console.log("Live API connected"),
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
            this.handleAudioOutput(base64Audio);
          }
          if (message.serverContent?.interrupted) {
            this.stopAudio();
            config.onInterrupted?.();
          }
          config.onMessage?.(message);
        },
        onclose: () => console.log("Live API closed"),
        onerror: (err) => console.error("Live API error:", err),
      },
    });

    await this.setupAudioInput();
  }

  private async setupAudioInput() {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // We need a worklet to convert Float32 to Int16 PCM
    await this.audioContext.audioWorklet.addModule(this.getWorkletUrl());
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
    
    this.workletNode.port.onmessage = (e) => {
      if (this.session) {
        const base64Data = this.arrayBufferToBase64(e.data);
        this.session.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      }
    };

    source.connect(this.workletNode);
  }

  sendVideoFrame(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'image/jpeg' }
      });
    }
  }

  private handleAudioOutput(base64Audio: string) {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Convert PCM16 to Float32
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    this.audioQueue.push(float32);
    this.processAudioQueue();
  }

  private async processAudioQueue() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) return;
    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const data = this.audioQueue.shift()!;
      const buffer = this.audioContext.createBuffer(1, data.length, 24000); // Model output is 24kHz
      buffer.getChannelData(0).set(data);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;
      
      await new Promise(resolve => {
        source.onended = resolve;
      });
    }

    this.isPlaying = false;
  }

  private stopAudio() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private getWorkletUrl() {
    const code = `
      class PCMProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input.length > 0) {
            const float32Data = input[0];
            const pcm16Data = new Int16Array(float32Data.length);
            for (let i = 0; i < float32Data.length; i++) {
              pcm16Data[i] = Math.max(-1, Math.min(1, float32Data[i])) * 32767;
            }
            this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;
    return URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  }

  disconnect() {
    this.session?.close();
    this.audioContext?.close();
  }
}
