import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const EyeButton = ({
    shown,
    onToggle,
  }: {
    shown: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-navy-400 transition-colors hover:text-navy-700"
    >
      {shown ? (
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
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });

      setSuccess('Password changed successfully! Logging out…');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to change password');
      } else {
        setError('Failed to change password');
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Change Password</h1>
        <p className="mt-1 text-sm text-navy-500">Update your admin account password</p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">Account Security</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="current-password" className="label">
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="input pr-11"
                placeholder="Enter current password"
              />
              <EyeButton shown={showCurrentPassword} onToggle={() => setShowCurrentPassword((v) => !v)} />
            </div>
          </div>

          <div>
            <label htmlFor="new-password" className="label">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="input pr-11"
                placeholder="Enter new password"
              />
              <EyeButton shown={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)} />
            </div>
            <p className="mt-1 text-sm text-navy-500">At least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="label">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input pr-11"
                placeholder="Confirm new password"
              />
              <EyeButton shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
