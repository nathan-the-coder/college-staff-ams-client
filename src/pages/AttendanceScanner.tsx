import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import api from '../lib/api';
import Seal from '../components/Seal';
import { loadFaceModels, detectFaceDescriptor, warmUpDetection } from '../lib/faceApi';

const SCAN_INTERVAL_MS = 3000;
const DETECT_RETRIES = 4;
const RETRY_DELAY_MS = 250;

interface CheckResult {
  success: boolean;
  name?: string;
  role?: string;
  type?: 'in' | 'out';
  isLate?: boolean;
  message?: string;
}

export default function AttendanceScanner() {
  const webcamRef = useRef<Webcam>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [recognizedUser, setRecognizedUser] = useState<{ name: string; role: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load the same face-api models used by Face Enrollment
  // (ssdMobilenetv1 + landmarks + recognition) so descriptors match.
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

  // Single detection pass: waits for the stream to be decodable, then returns
  // the 128-dim descriptor or null (transient/black frames return null).
  const detectDescriptor = useCallback(async (): Promise<number[] | null> => {
    return detectFaceDescriptor(webcamRef.current?.video);
  }, []);

  // Once the camera is live, run one throwaway detection so tfjs compiles its
  // kernels up front and the first real scan is fast.
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    warmUpDetection(webcamRef.current?.video);
  }, [isModelLoaded, isCameraReady]);

  const sendFrameToBackend = useCallback(async (): Promise<CheckResult | null> => {
    if (!isModelLoaded) return null;

    // Try a few frames before concluding there is no face.
    let descriptor: number[] | null = null;
    for (let i = 0; i < DETECT_RETRIES; i++) {
      descriptor = await detectDescriptor();
      if (descriptor) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    if (!descriptor) return null;

    const response = await api.post<CheckResult>('/attendance/check', {
      faceDescriptor: descriptor,
    });

    return response.data;
  }, [isModelLoaded, detectDescriptor]);

  const handleScan = useCallback(async () => {
    if (!isModelLoaded || !isCameraReady) return;

    setIsScanning(true);
    setMessage('Scanning...');
    setMessageType('info');
    setRecognizedUser(null);

    try {
      const data = await sendFrameToBackend();

      if (!data) {
        setMessage('No face detected. Please position your face in the camera.');
        setMessageType('error');
        return;
      }

      if (data.success) {
        const { name, role, type, isLate } = data;

        setRecognizedUser({ name: name || '', role: role || '' });

        setMessage(
          isLate
            ? `LATE: Time In recorded for ${name}`
            : `${type === 'in' ? 'Time In' : 'Time Out'} recorded for ${name}`
        );
        setMessageType('success');
      } else {
        setMessage(data.message || 'User not recognized');
        setMessageType('error');
      }
    } catch (error) {
      let errorMessage = 'Error processing. Please try again.';
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage =
            error.response.data?.message ||
            `Server error (${error.response.status}). Please wait a moment and try again.`;
        } else {
          errorMessage =
            'Cannot reach the attendance server. Please check the connection and try again.';
        }
      }
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsScanning(false);
    }
  }, [isModelLoaded, isCameraReady, sendFrameToBackend]);

  // Auto-scan every few seconds until someone is recognized.
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady || isScanning || recognizedUser) return;

    const interval = setInterval(() => handleScan(), SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady, isScanning, recognizedUser, handleScan]);

  const handleReset = () => {
    setRecognizedUser(null);
    setMessage('System ready. Please position your face in the camera.');
    setMessageType('info');
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Institutional header */}
      <header className="bg-navy-950">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Seal className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg text-white sm:text-xl">Staff Attendance System</h1>
            <p className="text-xs tracking-wide text-gold-300 sm:text-sm">
              Saint Joseph College of Baggao · For All Faculty and Staff
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

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8">
        {/* Kiosk heading */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl text-navy-900 sm:text-4xl">Face Time Attendance</h2>
          <p className="mt-1 text-sm text-navy-500">
            Look directly into the camera to record your time in and time out.
          </p>
        </div>

        {/* Live clock */}
        <div className="mb-6 flex items-center justify-center gap-6 border-y border-gold-200/60 py-3">
          <div className="text-center">
            <p className="font-display text-2xl text-navy-900 tabular-nums sm:text-3xl">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
          <div className="h-8 w-px bg-navy-200" />
          <div className="text-center">
            <p className="font-display text-sm text-navy-700 sm:text-base">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Scanner card */}
        <div className="card overflow-hidden">
          <div className="border-b border-navy-100 bg-navy-50/60 px-5 py-3">
            <p className="font-display text-sm font-semibold tracking-wide text-navy-900">
              Attendance Scanner
            </p>
          </div>

          <div className="p-5">
            <div className="relative mx-auto max-w-md">
              <div className="rounded-lg border-2 border-navy-800 p-1.5 shadow-lg">
                <div className="relative overflow-hidden rounded">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    onUserMedia={handleUserMedia}
                    onUserMediaError={handleUserMediaError}
                    className="aspect-[4/3] w-full bg-navy-950 object-cover"
                    videoConstraints={{
                      width: 640,
                      height: 480,
                      facingMode: 'user',
                    }}
                  />

                  {!isModelLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-navy-950/85">
                      <span className="text-sm font-medium text-navy-100">
                        Loading face recognition models…
                      </span>
                    </div>
                  )}

                  {isModelLoaded && !isCameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-navy-950/85">
                      <span className="text-sm font-medium text-navy-100">
                        Starting camera…
                      </span>
                    </div>
                  )}

                  {/* Corner accents */}
                  <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-gold-400" />
                  <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-gold-400" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-gold-400" />
                  <span className="pointer-events-none absolute right-0 bottom-0 h-4 w-4 border-r-2 border-b-2 border-gold-400" />

                  {recognizedUser && (
                    <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70 backdrop-blur-[1px]">
                      <div className="rounded-lg bg-white px-8 py-5 text-center shadow-xl ring-1 ring-gold-300">
                        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
                          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="font-display text-xl font-bold text-navy-900">{recognizedUser.name}</p>
                        <p className="text-sm text-navy-500">{recognizedUser.role}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message banner */}
            <div
              className={`mt-5 rounded-md border px-4 py-3 text-center text-sm font-medium ${
                messageType === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : messageType === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-navy-100 bg-navy-50 text-navy-700'
              }`}
            >
              {message || 'System ready. Please position your face in the camera.'}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning || !isModelLoaded || !isCameraReady}
                className="btn-gold flex-1 py-3 text-base"
              >
                {isScanning ? 'Scanning…' : 'Scan Now'}
              </button>

              {recognizedUser && (
                <button type="button" onClick={handleReset} className="btn-outline py-3">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-navy-100">
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
            <a href="/login" className="text-gold-600 underline underline-offset-2 hover:text-gold-700">
              Staff / Admin Login
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
