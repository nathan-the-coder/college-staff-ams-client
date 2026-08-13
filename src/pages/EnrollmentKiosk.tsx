import { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '../lib/api';
import Seal from '../components/Seal';
import { loadFaceModels, detectFaceDescriptor, warmUpDetection } from '../lib/faceApi';

const MANUAL_RETRIES = 10;
const RETRY_DELAY_MS = 250;

const TEACHING_DEPARTMENTS = [
  'Basic Education (Elementary)',
  'Basic Education (Junior High)',
  'Senior High School',
  'College Department',
];

const NON_TEACHING_OFFICES = [
  "Registrar's Office",
  'Accounting Office',
  'Guidance Office',
  'Administration',
  'IT Services',
  'Library',
  'Clinic / Health Office',
  'Maintenance & Custodial',
];

const CLASS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SESSION_KEY = 'enrollAuthorized';
const PASSWORD_KEY = 'enrollPassword';

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

export default function EnrollmentKiosk() {
  const webcamRef = useRef<Webcam>(null);
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [enrollPassword, setEnrollPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Teaching' | 'Non Teaching'>('Teaching');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const registeringRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const detectDescriptor = useCallback(async (): Promise<number[] | null> => {
    return detectFaceDescriptor(webcamRef.current?.video);
  }, []);

  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    warmUpDetection(webcamRef.current?.video);
  }, [isModelLoaded, isCameraReady]);

  const handleUnlock = async () => {
    setIsVerifying(true);
    setUnlockError('');
    try {
      const response = await api.post<{ valid: boolean; message?: string }>(
        '/enrollment/verify',
        { password: enrollPassword }
      );
      if (response.data.valid) {
        sessionStorage.setItem(SESSION_KEY, '1');
        sessionStorage.setItem(PASSWORD_KEY, enrollPassword);
        setIsUnlocked(true);
        setEnrollPassword('');
      } else {
        setUnlockError(response.data.message || 'Incorrect password');
      }
    } catch (error) {
      console.error('Enrollment unlock error:', error);
      setUnlockError('Cannot reach server. Please check your connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PASSWORD_KEY);
    setIsUnlocked(false);
    setEnrollPassword('');
    setMessage('');
    setMessageType('info');
  };

  const registerUser = useCallback(
    async (descriptor: number[]) => {
      setIsRegistering(true);
      setMessage('Registering…');
      setMessageType('info');
      try {
        const enrollPassword = sessionStorage.getItem(PASSWORD_KEY) || '';
        const response = await api.post<{ success: boolean; message?: string }>(
          '/enrollment/register',
          {
            password: enrollPassword,
            name: name.trim(),
            role,
            department: department.trim(),
            subject: role === 'Teaching' ? subject.trim() : '',
            teachingSchedule:
              role === 'Teaching' ? composeTeachingSchedule(scheduleDays, startTime, endTime) : '',
            faceDescriptor: descriptor,
          }
        );
        if (!response.data.success) {
          throw new Error(response.data.message || 'Registration failed. Please try again.');
        }
        setMessage('User registered successfully! You may enroll the next employee.');
        setMessageType('success');
        setName('');
        setDepartment('');
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
      }
    },
    [name, role, department, subject, scheduleDays, startTime, endTime]
  );

  const handleCapture = async () => {
    if (registeringRef.current) return;

    if (!name.trim()) {
      setMessage('Please enter the employee name first');
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
      setMessage('No face detected. Please position the face in the camera.');
      setMessageType('error');
      registeringRef.current = false;
      return;
    }

    await registerUser(descriptor);
  };

  const canCapture = isModelLoaded && isCameraReady && !isRegistering;

  const lockCard = (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-2xl border border-navy-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-navy-950 text-gold-400 ring-8 ring-navy-100">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy-950">Restricted Area</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-navy-500">
          Face enrollment is locked. Enter the enrollment password shared by the school
          administration to continue.
        </p>

        {unlockError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {unlockError}
          </div>
        )}

        <input
          type="password"
          value={enrollPassword}
          onChange={(e) => setEnrollPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUnlock();
          }}
          placeholder="Enter enrollment password"
          autoFocus
          className="input mt-5 text-center text-lg tracking-widest"
        />

        <button
          type="button"
          onClick={handleUnlock}
          disabled={isVerifying || !enrollPassword.trim()}
          className="btn-gold mt-4 w-full py-3 text-base font-bold"
        >
          {isVerifying ? 'Verifying…' : 'Unlock Enrollment'}
        </button>

        <p className="mt-5 text-xs text-navy-400">
          Forgot the password? Contact the Office of the Registrar.
        </p>
      </div>
    </div>
  );

  const enrollmentForm = (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-gold-200/80 bg-white p-4 shadow-sm sm:flex-row">
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
        <button
          type="button"
          onClick={handleLock}
          className="flex items-center gap-2 rounded-md border border-navy-300 px-4 py-2 text-sm font-semibold text-navy-700 transition-colors hover:border-red-400 hover:text-red-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Lock &amp; Exit
        </button>
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
                className="aspect-[4/3] w-full bg-navy-950 object-cover"
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
            </div>
            <p className="mt-4 text-xs leading-relaxed text-navy-400">
              Position the employee&apos;s face in the camera, then click
              &quot;Capture &amp; Register&quot;. A 128-point facial signature is saved and used to
              match future attendance scans.
            </p>
          </div>
        </div>

        <div className="card self-start overflow-hidden">
          <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-navy-900">Employee Details</h2>
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
              <span className="label">Role</span>
              <div className="grid grid-cols-2 gap-3">
                {(['Teaching', 'Non Teaching'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      setDepartment('');
                    }}
                    aria-pressed={role === r}
                    className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      role === r
                        ? 'border-navy-800 bg-navy-800 text-white'
                        : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="enroll-department" className="label">
                {role === 'Teaching' ? 'Department' : 'Office'}
              </label>
              <input
                id="enroll-department"
                type="text"
                list={role === 'Teaching' ? 'teaching-depts' : 'office-list'}
                placeholder={
                  role === 'Teaching'
                    ? 'e.g. Basic Education (Elementary)'
                    : "e.g. Registrar's Office"
                }
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input"
              />
              <datalist id="teaching-depts">
                {TEACHING_DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <datalist id="office-list">
                {NON_TEACHING_OFFICES.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-navy-400">
                {role === 'Teaching'
                  ? 'School level or department the employee teaches under'
                  : 'Office or unit the employee belongs to'}
              </p>
            </div>

            {role === 'Teaching' && (
              <>
                <div>
                  <label htmlFor="enroll-subject" className="label">
                    Subject Taught
                  </label>
                  <input
                    id="enroll-subject"
                    type="text"
                    placeholder="e.g. Mathematics 7"
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
              onClick={handleCapture}
              disabled={!canCapture}
              className="btn-gold w-full py-3 text-base font-bold"
            >
              {isRegistering ? 'Registering…' : 'Capture & Register'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="bg-navy-950">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Seal className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg text-white sm:text-xl font-bold tracking-wide">Face Enrollment Kiosk</h1>
            <p className="text-xs tracking-wide text-gold-300 sm:text-sm">
              Saint Joseph College of Baggao · Restricted Employee Registration
            </p>
          </div>
          <a
            href="/"
            className="ml-auto flex shrink-0 items-center gap-2 rounded-md border border-navy-600 px-4 py-2 text-sm font-medium text-navy-100 transition-colors hover:border-gold-400 hover:text-gold-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Scanner
          </a>
        </div>
        <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      </header>

      {isUnlocked ? enrollmentForm : lockCard}

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
        </div>
      </footer>
    </div>
  );
}
