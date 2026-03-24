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

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/users');
      setUsers(response.data.filter(u => u.role !== 'Admin'));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUser) params.append('userId', selectedUser);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get<AttendanceRecord[]>(
        `/attendance/dtr?${params}`
      );
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [selectedUser, startDate, endDate]);

  const processedRecords = useMemo(() => {
    const grouped: { [key: string]: AttendanceRecord[] } = {};
    
    records.forEach(record => {
      const date = new Date(record.timestamp).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(record);
    });

    const result: DailyRecord[] = Object.entries(grouped).map(([date, dayRecords]) => {
      const timeInRecord = dayRecords.find(r => r.type === 'in');
      const timeOutRecord = dayRecords.find(r => r.type === 'out');
      
      let hoursWorked = 0;
      if (timeInRecord && timeOutRecord) {
        const inTime = new Date(timeInRecord.timestamp).getTime();
        const outTime = new Date(timeOutRecord.timestamp).getTime();
        hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
      }

      return {
        date,
        timeIn: timeInRecord ? new Date(timeInRecord.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        timeOut: timeOutRecord ? new Date(timeOutRecord.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        isLate: timeInRecord?.isLate || false,
        status: timeInRecord ? (timeOutRecord ? 'Complete' : 'Incomplete') : 'No Record'
      };
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records]);

  const totalHours = useMemo(() => {
    return processedRecords.reduce((sum, r) => sum + r.hoursWorked, 0);
  }, [processedRecords]);

  const generateCSV = () => {
    let csv = 'Date,Time In,Time Out,Hours Worked,Late,Status\n';
    
    processedRecords.forEach(record => {
      csv += `${record.date},${record.timeIn || ''},${record.timeOut || ''},${record.hoursWorked},${record.isLate ? 'Yes' : 'No'},${record.status}\n`;
    });

    csv += `\nTotal Hours,${totalHours.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DTR_${getSelectedUserName().replace(' ', '_')}_${startDate || 'start'}_${endDate || 'end'}.csv`;
    a.click();
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
            body { font-family: Arial, sans-serif; padding: 20px; }
            .dtr-container { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .header p { font-size: 14px; margin-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f0f0f0; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .late { color: red; font-weight: bold; }
            .footer { margin-top: 20px; display: flex; justify-content: space-between; }
            .signature { width: 45%; }
            .signature-line { border-bottom: 1px solid #000; margin-top: 40px; }
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
    if (!selectedUser) return 'All Instructors';
    const user = users.find(u => u._id === selectedUser);
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
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Daily Time Record (DTR)</h1>
        <p className="text-gray-500 mt-1">Generate and export instructor attendance records</p>
      </div>

      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Instructor</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Instructors</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={generateCSV}
            disabled={records.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={records.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
        </div>
      </div>

      <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 print-only">
        <div className="header">
          <h1 className="text-xl font-bold">ATTENDANCE RECORD</h1>
          <p className="text-lg font-semibold">{getSelectedUserName()}</p>
          <p className="text-sm">Position: {selectedUser ? users.find(u => u._id === selectedUser)?.role : 'All Instructors'}</p>
          <p className="text-sm">Period: {formatDateRange()}</p>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : processedRecords.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No records found</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border">Date</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border">Time In</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border">Time Out</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border">Hours</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border">Late</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {processedRecords.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm border">
                      {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2 text-sm text-center border">{record.timeIn || '-'}</td>
                    <td className="px-4 py-2 text-sm text-center border">{record.timeOut || '-'}</td>
                    <td className="px-4 py-2 text-sm text-center border">{record.hoursWorked || '-'}</td>
                    <td className="px-4 py-2 text-sm text-center border">
                      {record.isLate ? <span className="text-red-600 font-bold">LATE</span> : <span className="text-green-600">-</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-center border">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        record.status === 'Complete' ? 'bg-green-100 text-green-800' : 
                        record.status === 'Incomplete' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-2 text-sm border" colSpan={3}>TOTAL HOURS</td>
                  <td className="px-4 py-2 text-sm text-center border">{totalHours.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm border" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>

            <div className="footer mt-8">
              <div className="signature">
                <div className="signature-line"></div>
                <p className="text-sm mt-1">Instructor Signature</p>
              </div>
              <div className="signature">
                <div className="signature-line"></div>
                <p className="text-sm mt-1">Principal/HR Signature</p>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 mt-6">
              <p>Generated on {new Date().toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>

      <div className="no-print px-6 py-4 border-t border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-500">
          Showing {processedRecords.length} days with {records.length} records | Total Hours: {totalHours.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
