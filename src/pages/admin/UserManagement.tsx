import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';

interface User {
  _id: string;
  name: string;
  role: string;
  department?: string;
  subject?: string;
  teachingSchedule?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'Teaching' | 'Non Teaching'>('Teaching');
  const [editDepartment, setEditDepartment] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editTeachingSchedule, setEditTeachingSchedule] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get<User[]>('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await api.get<User[]>('/users');
        if (!cancelled) setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role as 'Teaching' | 'Non Teaching');
    setEditDepartment(user.department || '');
    setEditSubject(user.subject || '');
    setEditTeachingSchedule(user.teachingSchedule || '');
  };

  const handleSave = async () => {
    if (!editingUser) return;
    if (!editName.trim()) {
      setNotice({ kind: 'error', text: 'Name cannot be empty.' });
      return;
    }

    try {
      await api.put(`/users/${editingUser._id}`, {
        name: editName.trim(),
        role: editRole,
        department: editDepartment.trim(),
        subject: editRole === 'Teaching' ? editSubject.trim() : '',
        teachingSchedule: editRole === 'Teaching' ? editTeachingSchedule.trim() : '',
      });
      setEditingUser(null);
      setNotice({ kind: 'success', text: 'User updated successfully.' });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setNotice({ kind: 'error', text: 'Failed to update user.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/users/${id}`);
      setNotice({ kind: 'success', text: 'User deleted successfully.' });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setNotice({ kind: 'error', text: 'Failed to delete user.' });
    }
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl text-navy-900">User Management</h1>
        <p className="mt-1 text-sm text-navy-500">Manage enrolled staff members</p>
      </div>

      {notice && (
        <div
          className={`mb-5 rounded-md border px-4 py-3 text-sm ${
            notice.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-navy-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <svg
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search users…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <span className="text-xs text-navy-400">
            {filteredUsers.length} of {users.length} staff
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-navy-100">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Role</th>
                <th className="table-th">Department</th>
                <th className="table-th">Subject / Schedule</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-navy-400">
                    Loading…
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user._id} className="transition-colors hover:bg-navy-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 font-display text-sm text-gold-200">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-navy-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`badge ${
                          user.role === 'Teaching'
                            ? 'bg-navy-100 text-navy-800'
                            : 'bg-gold-100 text-gold-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-navy-600">
                      {user.department || <span className="text-navy-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-navy-600">
                      {user.role === 'Teaching' && (user.subject || user.teachingSchedule) ? (
                        <div>
                          {user.subject && <p className="font-semibold text-navy-900">{user.subject}</p>}
                          {user.teachingSchedule && <p className="text-navy-500">{user.teachingSchedule}</p>}
                        </div>
                      ) : (
                        <span className="text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => handleEdit(user)} className="btn-outline px-3 py-1.5 text-xs">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(user._id)} className="btn-danger px-3 py-1.5 text-xs">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-navy-400">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="card w-full max-w-md">
            <div className="border-b border-navy-100 px-6 py-4">
              <h2 className="text-lg text-navy-900 font-bold">Edit Employee</h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div>
                <label htmlFor="edit-name" className="label">
                  Name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="edit-role" className="label">
                  Role
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'Teaching' | 'Non Teaching')}
                  className="input"
                >
                  <option value="Teaching">Teaching</option>
                  <option value="Non Teaching">Non Teaching</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-department" className="label">
                  Department / Office
                </label>
                <input
                  id="edit-department"
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="input"
                />
              </div>

              {editRole === 'Teaching' && (
                <>
                  <div>
                    <label htmlFor="edit-subject" className="label">
                      Subject Taught
                    </label>
                    <input
                      id="edit-subject"
                      type="text"
                      placeholder="e.g. IT 101 - Web Development"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-schedule" className="label">
                      Teaching Schedule (Days &amp; Time)
                    </label>
                    <input
                      id="edit-schedule"
                      type="text"
                      placeholder="e.g. Mon/Wed/Fri 08:00 AM - 10:00 AM"
                      value={editTeachingSchedule}
                      onChange={(e) => setEditTeachingSchedule(e.target.value)}
                      className="input"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 border-t border-navy-100 px-6 py-4">
              <button type="button" onClick={handleSave} className="btn-primary flex-1">
                Save Changes
              </button>
              <button type="button" onClick={() => setEditingUser(null)} className="btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
