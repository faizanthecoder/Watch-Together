import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Link2,
  Upload,
  AlertCircle,
  SkipBack,
} from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  isHost: boolean;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onLoadVideo: (url: string) => void;
  syncTrigger: { action: "play" | "pause" | "seek"; time: number; id: number } | null;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  videoUrl,
  isHost,
  onPlay,
  onPause,
  onSeek,
  onLoadVideo,
  syncTrigger,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [videoMode, setVideoMode] = useState<"url" | "upload">("url");
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const isSyncing = useRef(false);

  // Handle external sync triggers
  useEffect(() => {
    if (!syncTrigger || !videoRef.current) return;
    const video = videoRef.current;
    isSyncing.current = true;

    if (syncTrigger.action === "play") {
      video.currentTime = syncTrigger.time;
      video.play().catch(() => {}).finally(() => { isSyncing.current = false; });
      setPlaying(true);
    } else if (syncTrigger.action === "pause") {
      video.currentTime = syncTrigger.time;
      video.pause();
      setPlaying(false);
      isSyncing.current = false;
    } else if (syncTrigger.action === "seek") {
      video.currentTime = syncTrigger.time;
      isSyncing.current = false;
    }
  }, [syncTrigger]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (playing) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.paused) {
      video.play().then(() => {
        setPlaying(true);
        if (!isSyncing.current) onPlay(video.currentTime);
      }).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
      if (!isSyncing.current) onPause(video.currentTime);
    }
  }, [onPlay, onPause]);

  const handleSeek = useCallback((val: number[]) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    video.currentTime = val[0];
    setCurrentTime(val[0]);
  }, []);

  const handleSeekCommit = useCallback((val: number[]) => {
    if (!videoRef.current) return;
    setDragging(false);
    onSeek(val[0]);
  }, [onSeek]);

  const handleVolumeChange = useCallback((val: number[]) => {
    if (!videoRef.current) return;
    const v = val[0];
    videoRef.current.volume = v;
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !muted;
    videoRef.current.muted = newMuted;
    setMuted(newMuted);
  }, [muted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleLoadUrl = () => {
    if (!urlInput.trim()) return;
    setVideoError(null);
    onLoadVideo(urlInput.trim());
    setUrlInput("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setVideoError(null);
    onLoadVideo(blobUrl);
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div className="flex flex-col h-full">
        {/* Empty state */}
        <div className="flex-1 bg-black/90 rounded-lg flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center">
            <Play className="w-10 h-10 text-muted-foreground/40 fill-muted-foreground/40" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white/80 mb-1">No video loaded</h3>
            <p className="text-sm text-white/40">
              {isHost ? "Load a video to start watching together" : "Waiting for the host to load a video..."}
            </p>
          </div>

          {isHost && (
            <div className="w-full max-w-sm space-y-3">
              {/* Mode toggle */}
              <div className="flex rounded-md overflow-hidden border border-white/10">
                <button
                  data-testid="button-mode-url"
                  onClick={() => setVideoMode("url")}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    videoMode === "url"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-white/50"
                  }`}
                >
                  Paste URL
                </button>
                <button
                  data-testid="button-mode-upload"
                  onClick={() => setVideoMode("upload")}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    videoMode === "upload"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-white/50"
                  }`}
                >
                  Upload file
                </button>
              </div>

              {videoMode === "url" ? (
                <div className="flex gap-2">
                  <Input
                    data-testid="input-video-url"
                    placeholder="https://example.com/video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoadUrl()}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-xs h-9"
                  />
                  <Button
                    data-testid="button-load-url"
                    size="sm"
                    onClick={handleLoadUrl}
                    disabled={!urlInput.trim()}
                  >
                    <Link2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label
                  data-testid="input-video-file"
                  className="flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-md h-16 cursor-pointer bg-white/5 text-white/50 text-xs hover-elevate"
                >
                  <Upload className="w-4 h-4" />
                  Click to upload a video file
                  <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden group video-container"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain video-fade"
        onClick={handlePlayPause}
        onPlay={() => { if (!isSyncing.current) setPlaying(true); }}
        onPause={() => { if (!isSyncing.current) setPlaying(false); }}
        onTimeUpdate={() => {
          if (!dragging && videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setVideoError("Could not load this video. Check the URL or try another file.")}
        preload="metadata"
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-white/80 text-sm">{videoError}</p>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "40px 16px 12px",
        }}
      >
        {/* Progress bar */}
        <div className="mb-2">
          <Slider
            data-testid="slider-progress"
            min={0}
            max={duration || 100}
            step={0.1}
            value={[currentTime]}
            onValueChange={(val) => { setDragging(true); handleSeek(val); }}
            onValueCommit={handleSeekCommit}
            className="cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <Button
            data-testid="button-play-pause"
            size="icon"
            variant="ghost"
            className="text-white w-8 h-8 shrink-0"
            onClick={handlePlayPause}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </Button>

          {/* Skip back */}
          <Button
            data-testid="button-skip-back"
            size="icon"
            variant="ghost"
            className="text-white w-7 h-7 shrink-0"
            onClick={() => {
              if (!videoRef.current) return;
              const t = Math.max(0, videoRef.current.currentTime - 10);
              videoRef.current.currentTime = t;
              onSeek(t);
            }}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>

          {/* Time */}
          <span
            data-testid="text-video-time"
            className="text-white/80 text-xs font-mono shrink-0"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2 w-24 shrink-0">
            <Button
              data-testid="button-mute"
              size="icon"
              variant="ghost"
              className="text-white w-7 h-7 shrink-0"
              onClick={toggleMute}
            >
              {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
            <Slider
              data-testid="slider-volume"
              min={0}
              max={1}
              step={0.01}
              value={[muted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              className="w-14 cursor-pointer"
            />
          </div>

          {/* Fullscreen */}
          <Button
            data-testid="button-fullscreen"
            size="icon"
            variant="ghost"
            className="text-white w-7 h-7 shrink-0"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
