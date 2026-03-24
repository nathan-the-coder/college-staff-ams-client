import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../lib/api';

export default function AttendanceScanner() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizedUserRef = useRef<{ name: string; role: string } | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [recognizedUser, setRecognizedUser] = useState<{ name: string; role: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      setIsScanning(true);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
        setMessage('System ready. Please position your face in the camera.');
        setMessageType('info');
      } catch (error) {
        console.error('Error loading models:', error);
        setMessage('Failed to load face detection. Please refresh.');
        setMessageType('error');
      }
      setIsScanning(false);
    };
    loadModels();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const drawFaceBox = useCallback(async () => {
    if (!webcamRef.current || !canvasRef.current || !isModelLoaded) return;

    const video = webcamRef.current.video;
    if (!video || !video.readyState) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks();

      const isRecognized = recognizedUserRef.current !== null;

      detections.forEach((detection) => {
        const box = detection.detection.box;
        
        ctx.strokeStyle = isRecognized ? '#22c55e' : '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.fillStyle = isRecognized ? '#22c55e' : '#3b82f6';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(
          isRecognized ? recognizedUserRef.current!.name : 'Face Detected',
          box.x,
          box.y > 20 ? box.y - 10 : box.y + box.height + 20
        );
      });
    } catch (error) {
      // Silent fail for continuous detection
    }
  }, [isModelLoaded]);

  useEffect(() => {
    if (isModelLoaded) {
      const interval = setInterval(drawFaceBox, 100);
      return () => clearInterval(interval);
    }
  }, [isModelLoaded, drawFaceBox]);

  const handleScan = useCallback(async () => {
    if (!webcamRef.current || !isModelLoaded) return;

    const video = webcamRef.current.video;
    if (!video) return;

    setIsScanning(true);
    setMessage('Scanning...');
    setMessageType('info');
    setRecognizedUser(null);

    try {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setMessage('No face detected. Please try again.');
        setMessageType('error');
        setIsScanning(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const response = await api.post('/attendance/check', {
        faceDescriptor: descriptor,
      });

      if (response.data.success) {
        const { name, role, type, isLate } = response.data;
        recognizedUserRef.current = { name, role };
        setRecognizedUser({ name, role });
        
        if (isLate) {
          setMessage(`LATE: Time In recorded for ${name}`);
        } else {
          setMessage(`${type === 'in' ? 'Time In' : 'Time Out'} recorded for ${name}`);
        }
        setMessageType('success');
      } else {
        recognizedUserRef.current = null;
        setMessage(response.data.message || 'User not recognized');
        setMessageType('error');
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Scan error:', error);
      setMessage(err.response?.data?.message || 'Error processing. Please try again.');
      setMessageType('error');
    }
    setIsScanning(false);
  }, [isModelLoaded]);

  useEffect(() => {
    if (isModelLoaded && !isScanning && !recognizedUser) {
      const interval = setInterval(handleScan, 3000);
      return () => clearInterval(interval);
    }
  }, [isModelLoaded, isScanning, recognizedUser, handleScan]);

  const handleReset = () => {
    recognizedUserRef.current = null;
    setRecognizedUser(null);
    setMessage('System ready. Please position your face in the camera.');
    setMessageType('info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Staff Attendance</h1>
          <p className="text-blue-300 text-lg">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-5xl font-bold text-white mt-2">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
          <div className="relative mb-6">
            <div className={`rounded-xl overflow-hidden ${isModelLoaded ? 'ring-4 ring-green-500' : 'ring-4 ring-yellow-500'} ring-opacity-50`}>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full"
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: 'user',
                }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>
            
            {recognizedUser && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center rounded-xl">
                <div className="bg-white rounded-lg p-4 text-center">
                  <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xl font-bold text-gray-800">{recognizedUser.name}</p>
                  <p className="text-gray-500">{recognizedUser.role}</p>
                </div>
              </div>
            )}
          </div>

          <div className={`text-center py-4 px-6 rounded-lg mb-6 ${
            messageType === 'success' ? 'bg-green-500/20 text-green-300' :
            messageType === 'error' ? 'bg-red-500/20 text-red-300' :
            'bg-blue-500/20 text-blue-300'
          }`}>
            <p className="text-lg">{message}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleScan}
              disabled={!isModelLoaded || isScanning}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {isScanning ? 'Scanning...' : 'Scan Now'}
            </button>

            {recognizedUser && (
              <button
                onClick={handleReset}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Need help? <a href="/login" className="text-blue-400 hover:underline">Admin Login</a>
        </p>
      </div>
    </div>
  );
}
