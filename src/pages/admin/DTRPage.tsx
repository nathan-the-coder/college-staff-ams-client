import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../lib/api';

interface User {
  _id: string;
  name: string;
  role: string;
}

interface AttendanceRecord {
  _id: string;
  userId: string;
  name: string;
  role: string;
  type: 'in' | 'out';
  isLate: boolean;
  timestamp: string;
}

interface DailyRecord {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number;
  isLate: boolean;
  status: string;
}

export default function DTRPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await api.get<User[]>('/users');
        if (!cancelled) setUsers(response.data.filter((u) => u.role !== 'Admin'));
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedUser) params.append('userId', selectedUser);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await api.get<AttendanceRecord[]>(`/attendance/dtr?${params}`);
        if (!cancelled) setRecords(response.data);
      } catch (error) {
        console.error('Error fetching records:', error);
      }
      if (!cancelled) setIsLoading(false);
    };

    loadRecords();

    return () => {
      cancelled = true;
    };
  }, [selectedUser, startDate, endDate]);

  const processedRecords = useMemo(() => {
    const grouped: { [key: string]: AttendanceRecord[] } = {};

    records.forEach((record) => {
      const date = new Date(record.timestamp).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(record);
    });

    const result: DailyRecord[] = Object.entries(grouped).map(([date, dayRecords]) => {
      const timeInRecord = dayRecords.find((r) => r.type === 'in');
      const timeOutRecord = dayRecords.find((r) => r.type === 'out');

      let hoursWorked = 0;
      if (timeInRecord && timeOutRecord) {
        const inTime = new Date(timeInRecord.timestamp).getTime();
        const outTime = new Date(timeOutRecord.timestamp).getTime();
        hoursWorked = Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
      }

      return {
        date,
        timeIn: timeInRecord
          ? new Date(timeInRecord.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null,
        timeOut: timeOutRecord
          ? new Date(timeOutRecord.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        isLate: timeInRecord?.isLate || false,
        status: timeInRecord ? (timeOutRecord ? 'Complete' : 'Incomplete') : 'No Record',
      };
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records]);

  const totalHours = useMemo(() => {
    return processedRecords.reduce((sum, r) => sum + r.hoursWorked, 0);
  }, [processedRecords]);

  const generateCSV = () => {
    let csv = 'Date,Time In,Time Out,Hours Worked,Late,Status\n';

    processedRecords.forEach((record) => {
      csv += `${record.date},${record.timeIn || ''},${record.timeOut || ''},${record.hoursWorked},${record.isLate ? 'Yes' : 'No'},${record.status}\n`;
    });

    csv += `\nTotal Hours,${totalHours.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DTR_${getSelectedUserName().replace(/\s+/g, '_')}_${startDate || 'start'}_${endDate || 'end'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DTR - ${getSelectedUserName()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, 'Times New Roman', serif; padding: 20px; color: #253d04; }
            .dtr-container { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #253d04; padding-bottom: 10px; }
            .header h1 { font-size: 20px; letter-spacing: 1px; margin-bottom: 5px; }
            .header p { font-size: 14px; margin-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #253d04; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3ead0; }
            .text-center { text-align: center; }
            .late { color: #b91c1c; font-weight: bold; }
            .footer { margin-top: 20px; display: flex; justify-content: space-between; }
            .signature { width: 45%; }
            .signature-line { border-bottom: 1px solid #253d04; margin-top: 40px; }
            .signature p { font-size: 12px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const clearFilters = () => {
    setSelectedUser('');
    setStartDate('');
    setEndDate('');
  };

  const getSelectedUserName = () => {
    if (!selectedUser) return 'All Staff';
    const user = users.find((u) => u._id === selectedUser);
    return user?.name || 'Unknown';
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    } else if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString()}`;
    } else if (endDate) {
      return `Until ${new Date(endDate).toLocaleDateString()}`;
    }
    return 'All Records';
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-8">
        <h1 className="text-3xl text-navy-900">Daily Time Record</h1>
        <p className="mt-1 text-sm text-navy-500">Generate and export staff attendance records</p>
      </div>

      <div className="no-print card mb-6 overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-4">
          <div>
            <label htmlFor="dtr-user" className="label">
              Staff Member
            </label>
            <select
              id="dtr-user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="input"
            >
              <option value="">All Staff</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dtr-start" className="label">
              Start Date
            </label>
            <input
              id="dtr-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="dtr-end" className="label">
              End Date
            </label>
            <input
              id="dtr-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="btn-outline w-full">
              Clear Filters
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-navy-100 px-6 py-4 sm:flex-row">
          <button
            onClick={generateCSV}
            disabled={records.length === 0}
            className="btn-outline flex-1 sm:flex-none sm:px-6"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={records.length === 0}
            className="btn-primary flex-1 sm:flex-none sm:px-6"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
        </div>
      </div>

      <div ref={printRef} className="card print-only overflow-hidden p-6">
        <div className="header">
          <h1 className="font-display text-xl text-navy-900">ATTENDANCE RECORD</h1>
          <p className="font-display text-lg font-semibold text-navy-900">{getSelectedUserName()}</p>
          <p className="text-sm text-navy-500">
            Position: {selectedUser ? users.find((u) => u._id === selectedUser)?.role : 'All Staff'}
          </p>
          <p className="text-sm text-navy-500">Period: {formatDateRange()}</p>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-sm text-navy-400">Loading…</div>
        ) : processedRecords.length === 0 ? (
          <div className="p-6 text-center text-sm text-navy-400">No records found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-navy-100">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th text-center">Time In</th>
                    <th className="table-th text-center">Time Out</th>
                    <th className="table-th text-center">Hours</th>
                    <th className="table-th text-center">Late</th>
                    <th className="table-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {processedRecords.map((record, index) => (
                    <tr key={index} className="transition-colors hover:bg-navy-50/50">
                      <td className="px-4 py-3 text-sm text-navy-900">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-navy-700">
                        {record.timeIn || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-navy-700">
                        {record.timeOut || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-navy-700">
                        {record.hoursWorked || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {record.isLate ? (
                          <span className="font-bold text-red-600">LATE</span>
                        ) : (
                          <span className="text-green-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`badge ${
                            record.status === 'Complete'
                              ? 'bg-green-50 text-green-700'
                              : record.status === 'Incomplete'
                                ? 'bg-gold-100 text-gold-800'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-navy-100 bg-navy-50/60">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-navy-900" colSpan={3}>
                      TOTAL HOURS
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-navy-900">
                      {totalHours.toFixed(2)}
                    </td>
                    <td className="px-4 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="footer mt-10 flex justify-between">
              <div className="w-[45%]">
                <div className="border-b border-navy-900" style={{ marginTop: 40 }} />
                <p className="mt-1 text-xs text-navy-500">Staff Signature</p>
              </div>
              <div className="w-[45%]">
                <div className="border-b border-navy-900" style={{ marginTop: 40 }} />
                <p className="mt-1 text-xs text-navy-500">Principal / HR Signature</p>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-navy-400">
              <p>Generated on {new Date().toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>

      <div className="no-print mt-4 text-sm text-navy-400">
        Showing {processedRecords.length} days with {records.length} records · Total Hours:{' '}
        {totalHours.toFixed(2)}
      </div>
    </div>
  );
}
