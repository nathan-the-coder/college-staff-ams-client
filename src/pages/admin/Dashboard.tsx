import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface Stat {
  label: string;
  value: number;
  icon: string;
  color: string;
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
  faceDescriptor: number[];
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
    { label: 'Total Staff', value: 0, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'bg-blue-500' },
    { label: 'Present Today', value: 0, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-green-500' },
    { label: 'Absent Today', value: 0, icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-red-500' },
    { label: 'Teaching Staff', value: 0, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'bg-purple-500' },
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
        const present = logs.filter(log => log.type === 'in').length;
        const teaching = users.filter(u => u.role === 'Teaching').length;
        
        setStats(s => [
          { label: 'Total Staff', value: total, icon: s[0].icon, color: 'bg-blue-500' },
          { label: 'Present Today', value: present, icon: s[1].icon, color: 'bg-green-500' },
          { label: 'Absent Today', value: total - present, icon: s[2].icon, color: 'bg-red-500' },
          { label: 'Teaching Staff', value: teaching, icon: s[3].icon, color: 'bg-purple-500' },
        ]);
        
        setRecentLogs(logs.slice(0, 5).map(log => ({
          _id: log._id,
          name: log.name,
          role: log.role,
          time: new Date(log.timestamp).toLocaleTimeString(),
          type: log.type
        })));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of today's attendance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {isLoading ? '-' : stat.value}
                </p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Recent Activity</h2>
        </div>
        <div className="p-6">
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Loading...</p>
          ) : recentLogs.length > 0 ? (
            <div className="space-y-4">
              {recentLogs.map((log) => (
                <div key={log._id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${log.type === 'in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={log.type === 'in' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{log.name}</p>
                      <p className="text-sm text-gray-500">{log.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${log.type === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
                      {log.type === 'in' ? 'Time In' : 'Time Out'}
                    </p>
                    <p className="text-sm text-gray-500">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
