import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import Seal from '../../components/Seal';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', { username, password });

      if (data.token) {
        login(data.token);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Connection error. Please try again.');
      } else {
        setError('Connection error. Please try again.');
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      {/* Subtle gold rules flanking the page */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />

      <div className="w-full max-w-md">
        <div className="card overflow-hidden">
          <div className="bg-navy-900 px-8 py-8 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Seal className="h-16 w-16" />
            </div>
            <h1 className="text-2xl text-white">Staff Attendance System</h1>
            <p className="mt-1 text-sm text-gold-300">
              Saint Joseph College of Baggao · Administrative Portal
            </p>
          </div>

          <div className="px-8 py-8">
            {error && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="label">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="input"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="input pr-11"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-navy-400 transition-colors hover:text-navy-700"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/sjcb_logo.png"
              alt="Saint Joseph's College of Baggao, Inc."
              className="h-8 w-8 rounded-full object-contain"
            />
            <p className="text-xs text-navy-300">
              Saint Joseph&apos;s College of Baggao, Inc.
            </p>
          </div>
          <a href="/" className="text-sm text-navy-300 transition-colors hover:text-gold-200">
            ← Back to attendance scanner
          </a>
        </div>
      </div>
    </div>
  );
}
