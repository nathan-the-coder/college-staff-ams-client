import { useState, useEffect, useMemo, useRef } from 'react';
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
  name: string;
  role: string;
  session?: 'am' | 'pm';
  type: 'in' | 'out';
  isLate: boolean;
  timestamp: string;
}

interface DailyRecord {
  date: string;
  amIn: string | null;
  amOut: string | null;
  pmIn: string | null;
  pmOut: string | null;
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
      const getSession = (r: AttendanceRecord) => {
        if (r.session) return r.session;
        return new Date(r.timestamp).getHours() < 12 ? 'am' : 'pm';
      };

      const amInRecord = dayRecords.find((r) => getSession(r) === 'am' && r.type === 'in');
      const amOutRecord = dayRecords.find((r) => getSession(r) === 'am' && r.type === 'out');
      const pmInRecord = dayRecords.find((r) => getSession(r) === 'pm' && r.type === 'in');
      const pmOutRecord = dayRecords.find((r) => getSession(r) === 'pm' && r.type === 'out');

      let hoursWorked = 0;
      if (amInRecord && amOutRecord) {
        const inTime = new Date(amInRecord.timestamp).getTime();
        const outTime = new Date(amOutRecord.timestamp).getTime();
        hoursWorked += Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
      }
      if (pmInRecord && pmOutRecord) {
        const inTime = new Date(pmInRecord.timestamp).getTime();
        const outTime = new Date(pmOutRecord.timestamp).getTime();
        hoursWorked += Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
      }

      const formatT = (r?: AttendanceRecord) =>
        r ? new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

      const hasAnyIn = !!(amInRecord || pmInRecord);
      const isComplete = (amInRecord ? !!amOutRecord : true) && (pmInRecord ? !!pmOutRecord : true);

      return {
        date,
        amIn: formatT(amInRecord),
        amOut: formatT(amOutRecord),
        pmIn: formatT(pmInRecord),
        pmOut: formatT(pmOutRecord),
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        isLate: (amInRecord?.isLate || pmInRecord?.isLate) || false,
        status: hasAnyIn ? (isComplete ? 'Complete' : 'Incomplete') : 'No Record',
      };
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records]);

  const totalHours = useMemo(() => {
    return processedRecords.reduce((sum, r) => sum + r.hoursWorked, 0);
  }, [processedRecords]);

  const generateCSV = () => {
    let csv = 'Date,AM In,AM Out,PM In,PM Out,Hours Worked,Late,Status\n';

    processedRecords.forEach((record) => {
      csv += `${record.date},${record.amIn || ''},${record.amOut || ''},${record.pmIn || ''},${record.pmOut || ''},${record.hoursWorked},${record.isLate ? 'Yes' : 'No'},${record.status}\n`;
    });

    csv += `\nTotal Hours,,,,,${totalHours.toFixed(2)}\n`;

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
            .dtr-container { max-width: 850px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #253d04; padding-bottom: 10px; }
            .header h1 { font-size: 20px; letter-spacing: 1px; margin-bottom: 5px; }
            .header p { font-size: 14px; margin-bottom: 3px; }
            .school-mark { display: inline-block; margin-bottom: 6px; }
            .school-mark img { width: 56px; height: 56px; border-radius: 50%; object-fit: contain; }
            .school-name { font-size: 15px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #253d04; padding: 6px 8px; text-align: center; font-size: 11px; }
            th { background: #f3ead0; font-weight: bold; }
            .text-left { text-align: left; }
            .late { color: #b91c1c; font-weight: bold; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; }
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
    if (!selectedUser) return 'All Employees';
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
        .school-mark img { width: 56px; height: 56px; border-radius: 50%; object-fit: contain; }
        .school-name { font-size: 15px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
      `}</style>

      <div className="no-print mb-8">
        <h1 className="text-3xl text-navy-900 font-bold">Daily Time Record (DTR)</h1>
        <p className="mt-1 text-sm text-navy-500">Generate, print, and export 4-column institutional attendance reports</p>
      </div>

      <div className="no-print card mb-6 overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-4">
          <div>
            <label htmlFor="dtr-user" className="label">
              Employee
            </label>
            <select
              id="dtr-user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="input"
            >
              <option value="">All Employees</option>
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
            <button onClick={clearFilters} className="btn-outline w-full py-2.5">
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
        <div className="header text-center border-b-2 border-navy-950 pb-4 mb-4">
          <span className="school-mark mb-2 inline-block">
            <img src="/sjcb_logo.png" alt="SJCB Logo" className="mx-auto h-16 w-16 rounded-full object-contain" />
          </span>
          <h1 className="school-name font-display text-lg font-bold tracking-wider text-navy-950">SAINT JOSEPH&apos;S COLLEGE OF BAGGAO, INC.</h1>
          <p className="text-xs font-semibold text-gold-700 tracking-wide">DAILY TIME RECORD (CIVIL SERVICE FORM NO. 48)</p>
          <div className="mt-3">
            <p className="font-display text-xl font-bold text-navy-900">{getSelectedUserName()}</p>
            <p className="text-xs text-navy-600 font-medium">
              Position: {selectedUser ? users.find((u) => u._id === selectedUser)?.role : 'All Employees'}
            </p>
            {selectedUser && users.find((u) => u._id === selectedUser)?.department && (
              <p className="text-xs text-navy-500">
                Department: {users.find((u) => u._id === selectedUser)?.department}
              </p>
            )}
            <p className="text-xs text-navy-500 mt-0.5">Period: {formatDateRange()}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-sm text-navy-400">Loading attendance data…</div>
        ) : processedRecords.length === 0 ? (
          <div className="p-6 text-center text-sm text-navy-400">No attendance records found for this period</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-navy-900 bg-navy-50/80">
                    <th className="table-th text-left">Date</th>
                    <th className="table-th text-center">AM IN</th>
                    <th className="table-th text-center">AM OUT</th>
                    <th className="table-th text-center">PM IN</th>
                    <th className="table-th text-center">PM OUT</th>
                    <th className="table-th text-center">Hours</th>
                    <th className="table-th text-center">Late</th>
                    <th className="table-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {processedRecords.map((record, index) => (
                    <tr key={index} className="transition-colors hover:bg-navy-50/50">
                      <td className="px-4 py-2.5 text-xs font-medium text-navy-900 text-left whitespace-nowrap">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums font-semibold text-emerald-800">
                        {record.amIn || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums text-navy-700">
                        {record.amOut || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums font-semibold text-indigo-800">
                        {record.pmIn || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums text-navy-700">
                        {record.pmOut || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold tabular-nums text-navy-900">
                        {record.hoursWorked || '0'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs">
                        {record.isLate ? (
                          <span className="font-bold text-red-600">LATE</span>
                        ) : (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`badge text-[10px] ${
                            record.status === 'Complete'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'Incomplete'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-navy-950 bg-navy-50/80">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-navy-950 text-left" colSpan={5}>
                      TOTAL HOURS WORKED
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-bold tabular-nums text-navy-950">
                      {totalHours.toFixed(2)}
                    </td>
                    <td className="px-3 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="footer mt-12 flex justify-between px-4">
              <div className="w-[40%] text-center">
                <div className="border-b border-navy-900 mt-10" />
                <p className="mt-1.5 text-xs font-medium text-navy-800">Employee / Staff Signature</p>
              </div>
              <div className="w-[40%] text-center">
                <div className="border-b border-navy-900 mt-10" />
                <p className="mt-1.5 text-xs font-medium text-navy-800">In Charge / Registrar Signature</p>
              </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-navy-400">
              <p>Saint Joseph&apos;s College of Baggao, Inc. · Official Daily Time Record Document · Generated {new Date().toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>

      <div className="no-print mt-4 text-xs font-medium text-navy-500">
        Showing {processedRecords.length} days with {records.length} total scan entries · Aggregate Hours Worked:{' '}
        <span className="font-bold text-navy-900">{totalHours.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}
