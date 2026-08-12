import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface Stat {
  label: string;
  value: number;
  icon: string;
}

interface RecentLog {
  _id: string;
  name: string;
  role: string;
  time: string;
  type: 'in' | 'out';
}

interface User {
  _id: string;
  name: string;
  role: string;
}

interface AttendanceLog {
  _id: string;
  name: string;
  role: string;
  type: 'in' | 'out';
  timestamp: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Total Staff', value: 0, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Present Today', value: 0, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Absent Today', value: 0, icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Teaching', value: 0, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersRes = await api.get<User[]>('/users');
        const logsRes = await api.get<AttendanceLog[]>('/attendance/today');

        const users = usersRes.data;
        const logs = logsRes.data;

        const total = users.length;
        const present = logs.filter((log) => log.type === 'in').length;
        const instructors = users.filter((u) => u.role === 'Teaching').length;

        setStats([
          { label: 'Total Staff', value: total, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          { label: 'Present Today', value: present, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Absent Today', value: Math.max(total - present, 0), icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Teaching', value: instructors, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
        ]);

        setRecentLogs(
          logs.slice(0, 5).map((log) => ({
            _id: log._id,
            name: log.name,
            role: log.role,
            time: new Date(log.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            type: log.type,
          }))
        );
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Dashboard</h1>
        <p className="mt-1 text-sm text-navy-500">Overview of today&apos;s attendance</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={index} className="card relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-500 to-gold-300" />
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-xs font-bold tracking-wider text-navy-500 uppercase">
                  {stat.label}
                </p>
                <p className="font-display mt-2 text-4xl text-navy-900 tabular-nums">
                  {isLoading ? '–' : stat.value}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 ring-1 ring-navy-100">
                <svg className="h-6 w-6 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={stat.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <h2 className="text-lg text-navy-900">Recent Activity</h2>
          <span className="badge bg-navy-50 text-navy-600">Today</span>
        </div>
        <div className="px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-navy-400">Loading…</p>
          ) : recentLogs.length > 0 ? (
            <ul className="divide-y divide-navy-50">
              {recentLogs.map((log) => (
                <li key={log._id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        log.type === 'in' ? 'bg-green-50 text-green-700' : 'bg-gold-50 text-gold-700'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={log.type === 'in' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-navy-900">{log.name}</p>
                      <p className="text-xs text-navy-400">{log.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${log.type === 'in' ? 'text-green-700' : 'text-gold-700'}`}>
                      {log.type === 'in' ? 'Time In' : 'Time Out'}
                    </p>
                    <p className="text-xs text-navy-400 tabular-nums">{log.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-navy-400">No attendance recorded yet today.</p>
          )}
        </div>
      </div>
    </div>
  );
}
