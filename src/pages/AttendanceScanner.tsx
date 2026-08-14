import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import api from '../lib/api';
import Seal from '../components/Seal';
import { loadFaceModels, detectFaceWithBox, warmUpDetection } from '../lib/faceApi';

const SCAN_INTERVAL_MS = 3000;
const DETECT_RETRIES = 3;
const RETRY_DELAY_MS = 250;
const COUNTDOWN_SECONDS = 5;

type ScanMode = 'auto' | 'am_in' | 'am_out' | 'pm_in' | 'pm_out';

interface CheckResult {
  success: boolean;
  name?: string;
  role?: string;
  session?: 'am' | 'pm';
  type?: 'in' | 'out';
  slotLabel?: string;
  isLate?: boolean;
  timestamp?: string;
  alreadyLogged?: boolean;
  message?: string;
}

// Simple Web Audio API sound synthesizer for commercial kiosk feedback
function playChime(type: 'success' | 'warning' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);

      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.4);
    } else {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now); // A3 warning tone

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    // Audio play best-effort only
    console.warn('Audio playback not supported or blocked:', err);
  }
}

export default function AttendanceScanner() {
  const webcamRef = useRef<Webcam>(null);

  const [scanMode, setScanMode] = useState<ScanMode>('auto');
  const [isScanning, setIsScanning] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  const [lastResult, setLastResult] = useState<CheckResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer effect for result overlay auto-reset
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      handleReset();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Load face-api models
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        await loadFaceModels();
        if (!cancelled) setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading face models:', error);
        if (!cancelled) {
          setMessage('Failed to load face recognition models. Please refresh.');
          setMessageType('error');
        }
      }
    };

    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUserMedia = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    setIsCameraReady(false);
    const detail = typeof error === 'string' ? error : error?.message || '';
    setMessage(detail || 'Unable to access camera. Please check permissions.');
    setMessageType('error');
  }, []);

  // Warm up TensorFlow execution
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    warmUpDetection(webcamRef.current?.video);
  }, [isModelLoaded, isCameraReady]);

  const sendFrameToBackend = useCallback(async (): Promise<CheckResult | null> => {
    if (!isModelLoaded) return null;

    let descriptor: number[] | null = null;
    let box: { x: number; y: number; width: number; height: number } | null = null;
    let count = 0;

    for (let i = 0; i < DETECT_RETRIES; i++) {
      const res = await detectFaceWithBox(webcamRef.current?.video);
      descriptor = res.descriptor;
      box = res.box;
      count = res.faceCount;
      if (descriptor) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }

    setFaceBox(box);

    if (count > 1) {
      setMultipleFacesDetected(true);
      return {
        success: false,
        message: 'Multiple faces detected in frame. Please position only one person in front of the camera.'
      };
    } else {
      setMultipleFacesDetected(false);
    }

    if (!descriptor) return null;

    const response = await api.post<CheckResult>('/attendance/check', {
      faceDescriptor: descriptor,
      mode: scanMode
    });

    return response.data;
  }, [isModelLoaded, scanMode]);

  const handleScan = useCallback(async () => {
    if (!isModelLoaded || !isCameraReady || isScanning || lastResult) return;

    setIsScanning(true);
    setMessage('Scanning face...');
    setMessageType('info');

    try {
      const data = await sendFrameToBackend();

      if (!data) {
        setMessage('No face detected. Please look directly into the camera.');
        setMessageType('info');
        setFaceBox(null);
        return;
      }

      setLastResult(data);

      if (data.success) {
        playChime('success');
        setMessage(data.message || 'Attendance logged successfully.');
        setMessageType('success');
        setCountdown(COUNTDOWN_SECONDS);
      } else if (data.alreadyLogged) {
        playChime('warning');
        setMessage(data.message || 'Already logged for this slot.');
        setMessageType('warning');
        setCountdown(COUNTDOWN_SECONDS);
      } else {
        playChime('error');
        setMessage(data.message || 'Face not recognized.');
        setMessageType('error');
        setCountdown(COUNTDOWN_SECONDS);
      }
    } catch (error) {
      playChime('error');
      let errorMessage = 'Error processing face scan. Please try again.';
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage =
            error.response.data?.message ||
            `Server error (${error.response.status}). Please try again in a moment.`;
        } else {
          errorMessage = 'Cannot reach attendance server. Please check internet connection.';
        }
      }
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsScanning(false);
    }
  }, [isModelLoaded, isCameraReady, isScanning, lastResult, sendFrameToBackend]);

  // Auto-scan loop
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady || isScanning || lastResult) return;

    const interval = setInterval(() => {
      handleScan();
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady, isScanning, lastResult, handleScan]);

  function handleReset() {
    setLastResult(null);
    setCountdown(null);
    setFaceBox(null);
    setMultipleFacesDetected(false);
    setMessage('System ready. Position your face in the camera frame.');
    setMessageType('info');
  }

  const getModeLabel = (mode: ScanMode) => {
    switch (mode) {
      case 'am_in':
        return 'AM IN';
      case 'am_out':
        return 'AM OUT';
      case 'pm_in':
        return 'PM IN';
      case 'pm_out':
        return 'PM OUT';
      default:
        return 'Auto (Time In)';
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy-950">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Seal className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg text-white sm:text-xl font-bold tracking-wide">Staff Attendance System</h1>
            <p className="text-xs tracking-wide text-gold-300 sm:text-sm">
              Saint Joseph College of Baggao · Faculty &amp; Staff Kiosk Terminal
            </p>
          </div>
          <a
            href="/login"
            className="ml-auto rounded-md border border-navy-600 px-4 py-2 text-sm font-medium text-navy-100 transition-colors hover:border-gold-400 hover:text-gold-200"
          >
            Admin Login
          </a>
        </div>
        <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
        {/* Title */}
        <div className="mb-4 text-center">
          <h2 className="text-3xl text-navy-900 font-bold sm:text-4xl">Face Recognition Attendance</h2>
          <p className="mt-1 text-sm text-navy-600">
            Look directly into the camera to log your daily AM/PM time in and out.
          </p>
        </div>

        {/* Live Clock & Mode Bar */}
        <div className="mb-5 flex flex-col items-center justify-between gap-4 rounded-xl border border-gold-200/80 bg-white p-4 shadow-sm sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-950 text-gold-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-navy-950 tabular-nums">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
              <p className="text-xs font-medium text-navy-500">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* 5-Way Mode Selector Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg bg-navy-50 p-1.5 border border-navy-100">
            {(['auto', 'am_in', 'am_out', 'pm_in', 'pm_out'] as ScanMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setScanMode(mode);
                  handleReset();
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  scanMode === mode
                    ? 'bg-navy-900 text-white shadow-sm ring-1 ring-gold-400'
                    : 'text-navy-700 hover:bg-navy-200/60 hover:text-navy-900'
                }`}
              >
                {getModeLabel(mode)}
              </button>
            ))}
          </div>

          {/* Enrollment (password-locked) */}
          <a
            href="/enroll"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-sm font-bold text-gold-300 shadow-sm ring-1 ring-navy-800 transition-all hover:ring-gold-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Enroll Employee
          </a>
        </div>

        {/* Scanner Card */}
        <div className="card overflow-hidden shadow-lg border border-navy-200">
          <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/80 px-5 py-3">
            <span className="flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-navy-900">
              <span className={`h-2.5 w-2.5 rounded-full ${isScanning ? 'bg-gold-500 animate-ping' : 'bg-green-500'}`} />
              Attendance Scanner Kiosk
            </span>
            <span className="rounded bg-gold-100 px-2 py-0.5 text-xs font-bold text-navy-900">
              Mode: {getModeLabel(scanMode)}
            </span>
          </div>

          <div className="p-5">
            <div className="relative mx-auto max-w-md">
              <div className="relative rounded-xl border-4 border-navy-900 bg-navy-950 p-1 shadow-inner overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    onUserMedia={handleUserMedia}
                    onUserMediaError={handleUserMediaError}
                    className="h-full w-full object-cover"
                    videoConstraints={{
                      width: 640,
                      height: 480,
                      facingMode: 'user',
                    }}
                  />

                  {/* Real-time Bounding Box Overlay */}
                  {faceBox && isCameraReady && !lastResult && (
                    <div
                      className="pointer-events-none absolute border-2 border-gold-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all duration-150 rounded-lg"
                      style={{
                        left: `${(faceBox.x / 640) * 100}%`,
                        top: `${(faceBox.y / 480) * 100}%`,
                        width: `${(faceBox.width / 640) * 100}%`,
                        height: `${(faceBox.height / 480) * 100}%`,
                      }}
                    >
                      <span className="absolute -top-6 left-0 rounded bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-navy-950">
                        FACE DETECTED
                      </span>
                    </div>
                  )}

                  {!isModelLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950/90 text-center px-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent mb-3" />
                      <span className="text-sm font-medium text-navy-100">
                        Loading AI face recognition models…
                      </span>
                    </div>
                  )}

                  {isModelLoaded && !isCameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950/90 text-center px-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent mb-3" />
                      <span className="text-sm font-medium text-navy-100">
                        Connecting camera feed…
                      </span>
                    </div>
                  )}

                  {/* Scanner Overlay Line */}
                  {isScanning && !lastResult && (
                    <div className="pointer-events-none absolute inset-x-0 h-1 bg-gold-400 shadow-[0_0_12px_#facc15] animate-pulse" />
                  )}

                  {/* Kiosk Result Overlay Card */}
                  {lastResult && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950/85 p-4 backdrop-blur-sm animate-fade-in">
                      <div className={`w-full max-w-xs rounded-xl bg-white p-5 text-center shadow-2xl ring-2 ${
                        lastResult.success
                          ? 'ring-green-500'
                          : lastResult.alreadyLogged
                            ? 'ring-amber-500'
                            : 'ring-red-500'
                      }`}>
                        {lastResult.success ? (
                          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
                            lastResult.alreadyLogged ? 'bg-amber-100 text-amber-600 ring-8 ring-amber-50' : 'bg-red-100 text-red-600 ring-8 ring-red-50'
                          }`}>
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        )}

                        {lastResult.name && (
                          <>
                            <h3 className="font-display text-xl font-bold text-navy-950">{lastResult.name}</h3>
                            <p className="text-xs font-semibold uppercase text-navy-500 tracking-wider mt-0.5">{lastResult.role}</p>
                          </>
                        )}

                        {lastResult.slotLabel && (
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                              lastResult.type === 'in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {lastResult.slotLabel}
                            </span>
                            {lastResult.isLate && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                                LATE
                              </span>
                            )}
                          </div>
                        )}

                        <p className="mt-3 text-xs font-medium text-navy-700 leading-relaxed">
                          {lastResult.message}
                        </p>

                        {/* Countdown progress bar */}
                        {countdown !== null && (
                          <div className="mt-4 pt-3 border-t border-navy-100">
                            <p className="text-[11px] font-semibold text-navy-500">
                              Next scan in <span className="font-bold text-navy-900">{countdown}s</span>…
                            </p>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                              <div
                                className="h-full bg-gold-500 transition-all duration-1000 ease-linear"
                                style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleReset}
                          className="btn-outline mt-3 w-full py-1.5 text-xs font-bold"
                        >
                          Scan Next Person
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error / Warning Notice Banner */}
            {multipleFacesDetected && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800">
                ⚠️ Multiple faces detected in frame. Please ask others to step back so only one person is scanned.
              </div>
            )}

            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all ${
                messageType === 'success'
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : messageType === 'warning'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : messageType === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-navy-200 bg-navy-50 text-navy-800'
              }`}
            >
              {message || 'System ready. Position your face in the camera frame.'}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning || !isModelLoaded || !isCameraReady || !!lastResult}
                className="btn-gold flex-1 py-3 text-base font-bold shadow-sm"
              >
                {isScanning ? 'Scanning…' : 'Scan Now'}
              </button>

              {lastResult && (
                <button type="button" onClick={handleReset} className="btn-outline py-3 px-6 font-semibold">
                  Reset Scanner
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-navy-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-6 text-center">
          <div className="flex items-center gap-3">
            <img
              src="/sjcb_logo.png"
              alt="Saint Joseph's College of Baggao, Inc."
              className="h-10 w-10 rounded-full object-contain"
            />
            <div className="text-left">
              <p className="text-sm font-semibold text-navy-900">
                Saint Joseph&apos;s College of Baggao, Inc.
              </p>
              <p className="text-[11px] text-navy-500">
                Tuguegarao Archdiocesan Schools&apos; System
              </p>
            </div>
          </div>
          <p className="text-xs text-navy-500">
            This terminal is monitored by the Office of the Registrar.
          </p>
          <p className="text-xs text-gray-400">
            Need assistance? Contact the IT Services Office.&nbsp;
            <a href="/login" className="text-gold-600 underline underline-offset-2 hover:text-gold-700 font-medium">
              Staff / Admin Login
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
