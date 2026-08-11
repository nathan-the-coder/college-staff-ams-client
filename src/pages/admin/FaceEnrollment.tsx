import { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '../../lib/api';
import { loadFaceModels, detectFaceDescriptor, warmUpDetection } from '../../lib/faceApi';

const AUTO_SCAN_INTERVAL_MS = 400;
const STABLE_FRAMES_REQUIRED = 3;
const MANUAL_RETRIES = 10;
const RETRY_DELAY_MS = 250;

const CLASS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function composeTeachingSchedule(days: string[], start: string, end: string): string {
  const dayPart = CLASS_DAYS.filter((d) => days.includes(d)).join('/');
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  const timePart = hasStart && hasEnd
    ? `${formatTime12h(start)} - ${formatTime12h(end)}`
    : hasStart
      ? formatTime12h(start)
      : hasEnd
        ? `until ${formatTime12h(end)}`
        : '';
  if (!dayPart && !timePart) return '';
  return dayPart && timePart ? `${dayPart} ${timePart}` : dayPart || timePart;
}

export default function FaceEnrollment() {
  const webcamRef = useRef<Webcam>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Instructor' | 'Staff'>('Instructor');
  const [subject, setSubject] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

  const stableFramesRef = useRef(0);
  const registeringRef = useRef(false);
  const detectionInProgressRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        await loadFaceModels();
        if (!cancelled) setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading models:', error);
        if (!cancelled) {
          setMessage('Failed to load face detection models');
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
    setCameraError('');
  }, []);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    setIsCameraReady(false);
    const detail = typeof error === 'string' ? error : error?.message || '';
    setCameraError(detail || 'Unable to access camera. Please check permissions.');
  }, []);

  // Runs a single detection pass. Returns the 128-dim descriptor or null.
  const detectDescriptor = useCallback(async (): Promise<number[] | null> => {
    return detectFaceDescriptor(webcamRef.current?.video);
  }, []);

  // Once the camera is live, run one throwaway detection so tfjs compiles its
  // kernels up front and the first capture is fast.
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    warmUpDetection(webcamRef.current?.video);
  }, [isModelLoaded, isCameraReady]);

  const registerUser = useCallback(
    async (descriptor: number[]) => {
      setIsRegistering(true);
      setMessage('Registering…');
      setMessageType('info');
      try {
        await api.post('/users/register', {
          name: name.trim(),
          role,
          subject: role === 'Instructor' ? subject.trim() : '',
          teachingSchedule:
            role === 'Instructor' ? composeTeachingSchedule(scheduleDays, startTime, endTime) : '',
          faceDescriptor: descriptor,
        });
        setMessage('User registered successfully!');
        setMessageType('success');
        setName('');
        setSubject('');
        setScheduleDays([]);
        setStartTime('');
        setEndTime('');
      } catch (error) {
        console.error('Registration error:', error);
        setMessage('Failed to register. Please try again.');
        setMessageType('error');
      } finally {
        setIsRegistering(false);
        registeringRef.current = false;
        stableFramesRef.current = 0;
        setFaceDetected(false);
      }
    },
    [name, role, subject, scheduleDays, startTime, endTime]
  );

  // Auto-capture: keep looking for a face and register automatically once it
  // has been detected for several consecutive frames (avoids flicker).
  const runAutoDetection = useCallback(async () => {
    if (!isModelLoaded || !isCameraReady || registeringRef.current || !name.trim()) {
      return;
    }
    if (detectionInProgressRef.current) return;
    detectionInProgressRef.current = true;

    try {
      const descriptor = await detectDescriptor();

      if (descriptor) {
        stableFramesRef.current += 1;
        setFaceDetected(true);
        if (stableFramesRef.current >= STABLE_FRAMES_REQUIRED) {
          stableFramesRef.current = 0;
          registeringRef.current = true;
          await registerUser(descriptor);
        }
      } else {
        stableFramesRef.current = 0;
        setFaceDetected(false);
      }
    } finally {
      detectionInProgressRef.current = false;
    }
  }, [isModelLoaded, isCameraReady, name, detectDescriptor, registerUser]);

  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;

    const interval = setInterval(() => {
      runAutoDetection();
    }, AUTO_SCAN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady, runAutoDetection]);

  const handleManualCapture = async () => {
    if (registeringRef.current) return;

    if (!name.trim()) {
      setMessage('Please enter a name first');
      setMessageType('error');
      return;
    }

    registeringRef.current = true;
    setMessage('Scanning for face…');
    setMessageType('info');

    let descriptor: number[] | null = null;
    for (let i = 0; i < MANUAL_RETRIES; i++) {
      descriptor = await detectDescriptor();
      if (descriptor) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }

    if (!descriptor) {
      setMessage('No face detected. Please position your face in the camera.');
      setMessageType('error');
      registeringRef.current = false;
      return;
    }

    await registerUser(descriptor);
  };

  const canCapture = isModelLoaded && isCameraReady && !isRegistering;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Face Enrollment</h1>
        <p className="mt-1 text-sm text-navy-500">
          Enroll a new staff member&apos;s face for attendance scanning
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-navy-900">Camera Preview</h2>
          </div>
          <div className="p-6">
            <div className="relative overflow-hidden rounded-lg border-2 border-navy-800">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className={`aspect-[4/3] w-full bg-navy-950 object-cover ${faceDetected ? 'ring-4 ring-green-400/70' : ''}`}
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: 'user',
                }}
              />
              {!isModelLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-navy-950/85">
                  <span className="text-sm font-medium text-navy-100">Loading models…</span>
                </div>
              )}
              {isModelLoaded && !isCameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-navy-950/85">
                  <span className="text-sm font-medium text-navy-100">Starting camera…</span>
                </div>
              )}
              {isModelLoaded && isCameraReady && faceDetected && (
                <div className="absolute inset-x-0 bottom-0 bg-green-600/85 px-3 py-2 text-center text-sm font-medium text-white">
                  {isRegistering ? 'Registering…' : 'Face detected'}
                </div>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-navy-400">
              Hold still and look directly at the camera. Registration happens automatically once a
              stable face is captured, or use the button below for a manual capture.
            </p>
          </div>
        </div>

        <div className="card self-start overflow-hidden">
          <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-navy-900">Staff Details</h2>
          </div>
          <div className="space-y-5 p-6">
            {message && (
              <div
                className={`rounded-md border px-4 py-3 text-sm font-medium ${
                  messageType === 'success'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : messageType === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-navy-100 bg-navy-50 text-navy-700'
                }`}
              >
                {message}
              </div>
            )}

            {cameraError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Camera error: {cameraError}
              </div>
            )}

            <div>
              <label htmlFor="enroll-name" className="label">
                Full Name
              </label>
              <input
                id="enroll-name"
                type="text"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="enroll-role" className="label">
                Role
              </label>
              <select
                id="enroll-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'Instructor' | 'Staff')}
                className="input"
              >
                <option value="Instructor">Instructor</option>
                <option value="Staff">Staff</option>
              </select>
            </div>

            {role === 'Instructor' && (
              <>
                <div>
                  <label htmlFor="enroll-subject" className="label">
                    Subject Taught
                  </label>
                  <input
                    id="enroll-subject"
                    type="text"
                    placeholder="e.g. IT 101 - Computer Programming"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-navy-400">Assigned course or subject code</p>
                </div>

                <div>
                  <span className="label">Class Days</span>
                  <div className="flex flex-wrap gap-2">
                    {CLASS_DAYS.map((day) => {
                      const selected = scheduleDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setScheduleDays((prev) =>
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                            )
                          }
                          aria-pressed={selected}
                          className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            selected
                              ? 'border-navy-800 bg-navy-800 text-white'
                              : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-navy-400">Select the days this subject is taught</p>
                </div>

                <div>
                  <span className="label">Class Time</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="enroll-start" className="label">
                        Start Time
                      </label>
                      <input
                        id="enroll-start"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="enroll-end" className="label">
                        End Time
                      </label>
                      <input
                        id="enroll-end"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                  <p className="mt-2 rounded-md bg-navy-50 px-3 py-2 text-xs text-navy-600">
                    <span className="font-semibold">Schedule preview: </span>
                    {composeTeachingSchedule(scheduleDays, startTime, endTime) || 'Not set yet'}
                  </p>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleManualCapture}
              disabled={!canCapture}
              className="btn-gold w-full py-3"
            >
              {isRegistering ? 'Registering…' : 'Capture & Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
