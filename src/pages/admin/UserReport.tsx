import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';

interface AttendanceRecord {
  _id: string;
  name: string;
  role: string;
  type: 'in' | 'out';
  timestamp: string;
}

export default function UserReport() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecords = async () => {
    try {
      const response = await api.get<AttendanceRecord[]>('/attendance');
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (dateFilter) {
      filtered = filtered.filter(
        (record) =>
          new Date(record.timestamp).toDateString() === new Date(dateFilter).toDateString()
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((record) => record.role === roleFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter((record) =>
        record.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [records, dateFilter, roleFilter, searchQuery]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setRoleFilter('all');
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Attendance Reports</h1>
        <p className="mt-1 text-sm text-navy-500">View and filter attendance records</p>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-5 border-b border-navy-100 p-6 md:grid-cols-3">
          <div>
            <label htmlFor="report-search" className="label">
              Search
            </label>
            <input
              id="report-search"
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="report-date" className="label">
              Date
            </label>
            <input
              id="report-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="report-role" className="label">
              Role
            </label>
            <select
              id="report-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Roles</option>
              <option value="Instructor">Instructor</option>
              <option value="Staff">Staff</option>
            </select>
          </div>
        </div>

        {(searchQuery || dateFilter || roleFilter !== 'all') && (
          <div className="border-b border-navy-100 px-6 py-3">
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-gold-700 hover:text-gold-800"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-navy-100 bg-navy-50/60">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Role</th>
                <th className="table-th">Type</th>
                <th className="table-th">Date</th>
                <th className="table-th">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-navy-400">
                    Loading…
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record._id} className="transition-colors hover:bg-navy-50/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800">
                          <span className="text-sm font-semibold text-gold-300">
                            {record.name.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-navy-900">{record.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                      {record.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          record.type === 'in'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gold-100 text-gold-800'
                        }`}
                      >
                        {record.type === 'in' ? 'Time In' : 'Time Out'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                      {formatDate(record.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums text-navy-600">
                      {formatTime(record.timestamp)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-navy-400">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-navy-100 bg-navy-50/60 px-6 py-4">
          <p className="text-sm text-navy-500">
            Showing {filteredRecords.length} of {records.length} records
          </p>
        </div>
      </div>
    </div>
  );
}
