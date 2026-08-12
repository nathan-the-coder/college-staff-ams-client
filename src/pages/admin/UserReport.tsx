import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';

interface AttendanceRecord {
  _id: string;
  userId: string;
  name: string;
  role: string;
  session?: 'am' | 'pm';
  type: 'in' | 'out';
  isLate?: boolean;
  timestamp: string;
}

interface User {
  _id: string;
  name: string;
  role: string;
  department?: string;
}

interface DailyRow {
  key: string;
  name: string;
  role: string;
  department: string;
  date: string;
  amIn: string | null;
  amOut: string | null;
  pmIn: string | null;
  pmOut: string | null;
  isLate: boolean;
}

export default function UserReport() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [recordsRes, usersRes] = await Promise.all([
          api.get<AttendanceRecord[]>('/attendance'),
          api.get<User[]>('/users'),
        ]);
        if (!cancelled) {
          setRecords(recordsRes.data);
          setUsers(usersRes.data);
        }
      } catch (error) {
        console.error('Error fetching records:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u._id, u));
    return map;
  }, [users]);

  const departments = useMemo(() => {
    const depts = users
      .map((u) => u.department?.trim())
      .filter((d): d is string => Boolean(d));
    return Array.from(new Set(depts)).sort();
  }, [users]);

  const getSession = (record: AttendanceRecord): 'am' | 'pm' => {
    if (record.session) return record.session;
    return new Date(record.timestamp).getHours() < 12 ? 'am' : 'pm';
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedRows = useMemo(() => {
    const grouped = new Map<string, DailyRow>();

    records.forEach((record) => {
      const date = new Date(record.timestamp).toDateString();
      const user = userMap.get(record.userId);
      const key = `${record.userId}|${date}`;

      let row = grouped.get(key);
      if (!row) {
        row = {
          key,
          name: record.name,
          role: record.role,
          department: user?.department || '',
          date,
          amIn: null,
          amOut: null,
          pmIn: null,
          pmOut: null,
          isLate: false,
        };
        grouped.set(key, row);
      }

      const session = getSession(record);
      const time = formatTime(record.timestamp);

      if (session === 'am' && record.type === 'in') {
        row.amIn = time;
        if (record.isLate) row.isLate = true;
      } else if (session === 'am' && record.type === 'out') {
        row.amOut = time;
      } else if (session === 'pm' && record.type === 'in') {
        row.pmIn = time;
        if (record.isLate) row.isLate = true;
      } else if (session === 'pm' && record.type === 'out') {
        row.pmOut = time;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.name.localeCompare(b.name);
    });
  }, [records, userMap]);

  const filteredRows = useMemo(() => {
    return groupedRows.filter((row) => {
      if (
        dateFilter &&
        new Date(row.date).toDateString() !== new Date(dateFilter).toDateString()
      ) {
        return false;
      }
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      if (deptFilter !== 'all' && row.department !== deptFilter) return false;
      if (searchQuery && !row.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [groupedRows, dateFilter, roleFilter, deptFilter, searchQuery]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setRoleFilter('all');
    setDeptFilter('all');
  };

  const hasActiveFilters = Boolean(searchQuery || dateFilter || roleFilter !== 'all' || deptFilter !== 'all');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">Attendance Reports</h1>
        <p className="mt-1 text-sm text-navy-500">Daily AM / PM attendance summary per employee</p>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-5 border-b border-navy-100 p-6 md:grid-cols-4">
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
              <option value="Teaching">Teaching</option>
              <option value="Non Teaching">Non Teaching</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-dept" className="label">
              Department
            </label>
            <select
              id="report-dept"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
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
                <th className="table-th">Employee</th>
                <th className="table-th">Role</th>
                <th className="table-th">Department</th>
                <th className="table-th">Date</th>
                <th className="table-th">AM IN</th>
                <th className="table-th">AM OUT</th>
                <th className="table-th">PM IN</th>
                <th className="table-th">PM OUT</th>
                <th className="table-th">Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-navy-400">
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.key} className="transition-colors hover:bg-navy-50/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800">
                          <span className="text-sm font-semibold text-gold-300">
                            {row.name.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-navy-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                      {row.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                      {row.department || <span className="text-navy-300">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {row.amIn ? (
                        <span className="text-sm font-semibold tabular-nums text-emerald-800">
                          {row.amIn}
                        </span>
                      ) : (
                        <span className="text-sm text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {row.amOut ? (
                        <span className="text-sm tabular-nums text-navy-700">{row.amOut}</span>
                      ) : (
                        <span className="text-sm text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {row.pmIn ? (
                        <span className="text-sm font-semibold tabular-nums text-indigo-800">
                          {row.pmIn}
                        </span>
                      ) : (
                        <span className="text-sm text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {row.pmOut ? (
                        <span className="text-sm tabular-nums text-navy-700">{row.pmOut}</span>
                      ) : (
                        <span className="text-sm text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {row.isLate ? (
                        <span className="badge bg-red-100 text-red-800">LATE</span>
                      ) : (
                        <span className="text-sm text-navy-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-navy-400">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-navy-100 bg-navy-50/60 px-6 py-4">
          <p className="text-sm text-navy-500">
            Showing {filteredRows.length} of {groupedRows.length} employee-day records
          </p>
        </div>
      </div>
    </div>
  );
}
