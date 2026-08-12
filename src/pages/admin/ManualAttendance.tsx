import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';

interface User {
  _id: string;
  name: string;
  role: string;
  department?: string;
}

interface AttendanceRecord {
  _id: string;
  userId: string;
  session?: 'am' | 'pm';
  type: 'in' | 'out';
  timestamp: string;
}

interface TimeInputs {
  amIn: string;
  amOut: string;
  pmIn: string;
  pmOut: string;
}

const EMPTY_TIMES: TimeInputs = { amIn: '', amOut: '', pmIn: '', pmOut: '' };

const SLOTS: { key: keyof TimeInputs; label: string; session: 'am' | 'pm'; type: 'in' | 'out' }[] = [
  { key: 'amIn', label: 'AM IN', session: 'am', type: 'in' },
  { key: 'amOut', label: 'AM OUT', session: 'am', type: 'out' },
  { key: 'pmIn', label: 'PM IN', session: 'pm', type: 'in' },
  { key: 'pmOut', label: 'PM OUT', session: 'pm', type: 'out' },
];

function toInputTime(timestamp: string): string {
  const t = new Date(timestamp);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export default function ManualAttendance() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [times, setTimes] = useState<TimeInputs>(EMPTY_TIMES);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await api.get<User[]>('/users');
        if (!cancelled) {
          setUsers(response.data.filter((u) => u.role !== 'Admin'));
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadExisting = async () => {
      if (!userId || !date) {
        setTimes(EMPTY_TIMES);
        return;
      }
      try {
        const params = new URLSearchParams({
          userId,
          startDate: date,
          endDate: date,
        });
        const response = await api.get<AttendanceRecord[]>(`/attendance/dtr?${params}`);
        if (cancelled) return;

        const getTime = (session: 'am' | 'pm', type: 'in' | 'out') => {
          const record = response.data.find(
            (r) => (r.session ? r.session : new Date(r.timestamp).getHours() < 12 ? 'am' : 'pm') === session && r.type === type
          );
          return record ? toInputTime(record.timestamp) : '';
        };

        setTimes({
          amIn: getTime('am', 'in'),
          amOut: getTime('am', 'out'),
          pmIn: getTime('pm', 'in'),
          pmOut: getTime('pm', 'out'),
        });
      } catch (error) {
        console.error('Error loading existing records:', error);
      }
    };

    loadExisting();

    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  const selectedUser = useMemo(
    () => users.find((u) => u._id === userId),
    [users, userId]
  );

  const handleSave = async () => {
    if (!userId) {
      setNotice({ kind: 'error', text: 'Please select an employee first.' });
      return;
    }
    if (!date) {
      setNotice({ kind: 'error', text: 'Please select a date.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      await api.post('/attendance/manual', {
        userId,
        date,
        amIn: times.amIn,
        amOut: times.amOut,
        pmIn: times.pmIn,
        pmOut: times.pmOut,
      });
      setNotice({
        kind: 'success',
        text: `Daily time record saved for ${selectedUser?.name || 'employee'} on ${new Date(`${date}T00:00:00`).toLocaleDateString()}.`,
      });
    } catch (error) {
      console.error('Error saving manual attendance:', error);
      setNotice({
        kind: 'error',
        text: 'Failed to save. Check that times are in HH:MM (24-hour) format.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const setSlot = (key: keyof TimeInputs, value: string) => {
    setTimes((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Manual DTR Entry</h1>
        <p className="mt-1 text-sm text-navy-500">
          Record or correct an employee&apos;s time in/out for a specific date (e.g. power
          interruption or disaster)
        </p>
      </div>

      {notice && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm font-medium ${
            notice.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : notice.kind === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-navy-100 bg-navy-50 text-navy-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="card max-w-3xl overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">Time Record</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <label htmlFor="manual-user" className="label">
              Employee
            </label>
            <select
              id="manual-user"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setNotice(null);
              }}
              className="input"
              disabled={isLoadingUsers}
            >
              <option value="">Select an employee…</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} — {user.role}
                  {user.department ? ` · ${user.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="manual-date" className="label">
              Date
            </label>
            <input
              id="manual-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setNotice(null);
              }}
              className="input"
            />
          </div>
        </div>

        <div className="border-t border-navy-100 px-6 py-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SLOTS.map((slot) => (
              <div key={slot.key}>
                <label htmlFor={`manual-${slot.key}`} className="label">
                  {slot.label}
                </label>
                <input
                  id={`manual-${slot.key}`}
                  type="time"
                  value={times[slot.key]}
                  onChange={(e) => setSlot(slot.key, e.target.value)}
                  className="input"
                />
              </div>
            ))}
          </div>

          <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            Leave a slot blank to clear any existing entry for that time. Saving overwrites the
            recorded times for this employee on this date. Late status is computed against the
            configured late threshold.
          </p>
        </div>

        <div className="border-t border-navy-100 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoadingUsers || !userId}
            className="btn-primary px-8"
          >
            {isSaving ? 'Saving…' : 'Save Daily Time Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
