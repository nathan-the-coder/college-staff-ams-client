import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import api from '../../lib/api';

export default function FaceEnrollment() {
  const webcamRef = useRef<Webcam>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Teaching' | 'Non-Teaching'>('Teaching');

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      setIsLoading(true);
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading models:', error);
        setMessage('Failed to load face detection models');
      }
      setIsLoading(false);
    };
    loadModels();
  }, []);

  const handleCapture = async () => {
    if (!webcamRef.current) return;

    const video = webcamRef.current.video;
    if (!video) {
      setMessage('Camera not ready');
      return;
    }

    if (!name.trim()) {
      setMessage('Please enter a name');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setMessage('No face detected. Please position your face in the camera.');
        setIsLoading(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      await api.post('/users/register', {
        name: name.trim(),
        role,
        faceDescriptor: descriptor
      });

      setMessage('User registered successfully!');
      setName('');
    } catch (error) {
      console.error('Capture error:', error);
      setMessage('Failed to register. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Face Enrollment</h1>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-center ${
            message.includes('success') ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            {message}
          </div>
        )}

        {isLoading && !isModelLoaded ? (
          <div className="text-white text-center">Loading models...</div>
        ) : (
          <>
            <div className="relative mb-4">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full rounded-lg"
              />
              {!isModelLoaded && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <span className="text-white">Loading camera...</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'Teaching' | 'Non-Teaching')}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Teaching">Teaching</option>
                <option value="Non-Teaching">Non-Teaching</option>
              </select>

              <button
                onClick={handleCapture}
                disabled={isLoading || !isModelLoaded}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                {isLoading ? 'Processing...' : 'Capture & Register'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
