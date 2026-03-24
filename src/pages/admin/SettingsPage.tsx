import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface Settings {
  lateThreshold: string;
  workStartTime: string;
  workEndTime: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    lateThreshold: '08:00',
    workStartTime: '08:00',
    workEndTime: '17:00'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings({
        lateThreshold: response.data.lateThreshold || '08:00',
        workStartTime: response.data.workStartTime || '08:00',
        workEndTime: response.data.workEndTime || '17:00'
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    try {
      await api.post('/settings/bulk', settings);
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings');
    }
    
    setIsSaving(false);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Configure system settings</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Work Hours & Late Threshold</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Late Threshold (Time In)
            </label>
            <input
              type="time"
              value={settings.lateThreshold}
              onChange={(e) => setSettings({ ...settings, lateThreshold: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-sm text-gray-500 mt-1">
              Arrivals after this time are marked as late
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Start Time
            </label>
            <input
              type="time"
              value={settings.workStartTime}
              onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-sm text-gray-500 mt-1">
              Standard work start time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work End Time
            </label>
            <input
              type="time"
              value={settings.workEndTime}
              onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-sm text-gray-500 mt-1">
              Standard work end time
            </p>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">System Information</h2>
        <div className="space-y-2 text-gray-600">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Database:</strong> MongoDB (Local)</p>
          <p><strong>Face Recognition:</strong> face-api.js</p>
        </div>
      </div>
    </div>
  );
}
