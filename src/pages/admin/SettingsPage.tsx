import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface Settings {
  lateThreshold: string;
  workStartTime: string;
  workEndTime: string;
  enrollPassword: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    lateThreshold: '08:00',
    workStartTime: '08:00',
    workEndTime: '17:00',
    enrollPassword: 'sjcb2026',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await api.get('/settings');
        if (!cancelled) {
          setSettings({
            lateThreshold: response.data.lateThreshold || '08:00',
            workStartTime: response.data.workStartTime || '08:00',
            workEndTime: response.data.workEndTime || '17:00',
            enrollPassword: response.data.enrollPassword || 'sjcb2026',
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
      if (!cancelled) setIsLoading(false);
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      await api.post('/settings/bulk', settings);
      setMessageType('success');
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessageType('error');
      setMessage('Failed to save settings');
    }

    setIsSaving(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Settings</h1>
        <p className="mt-1 text-sm text-navy-500">Configure system work hours and thresholds</p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm font-medium ${
            messageType === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="card max-w-3xl overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">
            Work Hours &amp; Late Threshold
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
          <div>
            <label htmlFor="settings-late" className="label">
              Late Threshold (Time In)
            </label>
            <input
              id="settings-late"
              type="time"
              value={settings.lateThreshold}
              onChange={(e) => setSettings({ ...settings, lateThreshold: e.target.value })}
              className="input"
            />
            <p className="mt-1 text-sm text-navy-500">Arrivals after this time are marked as late</p>
          </div>

          <div>
            <label htmlFor="settings-start" className="label">
              Work Start Time
            </label>
            <input
              id="settings-start"
              type="time"
              value={settings.workStartTime}
              onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
              className="input"
            />
            <p className="mt-1 text-sm text-navy-500">Standard work start time</p>
          </div>

          <div>
            <label htmlFor="settings-end" className="label">
              Work End Time
            </label>
            <input
              id="settings-end"
              type="time"
              value={settings.workEndTime}
              onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
              className="input"
            />
            <p className="mt-1 text-sm text-navy-500">Standard work end time</p>
          </div>
        </div>

        <div className="border-t border-navy-100 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="btn-primary px-8"
          >
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="card mt-6 max-w-3xl overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">
            Enrollment Security
          </h2>
        </div>
        <div className="p-6">
          <div className="max-w-sm">
            <label htmlFor="settings-enroll-password" className="label">
              Face Enrollment Password
            </label>
            <input
              id="settings-enroll-password"
              type="text"
              value={settings.enrollPassword}
              onChange={(e) => setSettings({ ...settings, enrollPassword: e.target.value })}
              className="input"
            />
            <p className="mt-1 text-sm text-navy-500">
              Shared secret required to unlock the enrollment kiosk. Share only with employees
              and the administration.
            </p>
          </div>
        </div>
      </div>

      <div className="card mt-6 max-w-3xl overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">System Information</h2>
        </div>
        <div className="space-y-2 px-6 py-5 text-sm text-navy-600">
          <p>
            <span className="font-semibold text-navy-900">Version:</span> 1.0.0
          </p>
          <p>
            <span className="font-semibold text-navy-900">Database:</span> MongoDB
          </p>
          <p>
            <span className="font-semibold text-navy-900">Face Recognition:</span> face-api.js
          </p>
        </div>
      </div>
    </div>
  );
}
