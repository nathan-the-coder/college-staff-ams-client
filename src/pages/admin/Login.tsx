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
              <Seal className="h-16 w-[3.2rem]" />
            </div>
            <h1 className="text-2xl text-white">Staff Attendance System</h1>
            <p className="mt-1 text-sm text-gold-300">Administrative Portal</p>
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
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="input"
                  placeholder="Enter your password"
                />
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

        <p className="mt-6 text-center">
          <a href="/" className="text-sm text-navy-300 transition-colors hover:text-gold-200">
            ← Back to attendance scanner
          </a>
        </p>
      </div>
    </div>
  );
}
