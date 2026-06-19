import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Users, AlertTriangle, Activity, Database, CheckCircle, XCircle } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isFrozen: boolean;
  createdAt: string;
}

interface WithdrawalItem {
  id: string;
  amount: string;
  fee: string;
  network: string;
  address: string;
  createdAt: string;
  wallet: {
    coinSymbol: string;
    user: { email: string };
  };
}

interface AuditLog {
  id: string;
  action: string;
  ipAddress: string;
  details: string | null;
  createdAt: string;
  user: { email: string } | null;
}

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalTradesCount: 0, totalVolume: 0, totalFeesCollected: 0 });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAdminData = async () => {
    try {
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      const usersRes = await api.get('/admin/users');
      setUsers(usersRes.data);

      const withRes = await api.get('/admin/withdrawals');
      setWithdrawals(withRes.data);

      const logsRes = await api.get('/admin/logs');
      setAuditLogs(logsRes.data);
    } catch (err) {
      setError('Failed to fetch system logs or management directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleFreeze = async (userId: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/admin/users/${userId}/freeze`);
      setSuccess(res.data.message);
      loadAdminData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user freeze status');
    }
  };

  const handleReviewWithdrawal = async (txnId: string, action: 'APPROVE' | 'REJECT') => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/admin/withdrawals/${txnId}/review`, { action });
      setSuccess(res.data.message);
      loadAdminData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Review failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading administrative tools...</div>;
  }

  return (
    <div className="bg-[#0A0E17] min-h-[90vh] text-gray-100 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Notifications */}
      {error && <div className="bg-red-950/40 border border-red-800 text-red-200 px-4 py-3 rounded text-sm text-center">{error}</div>}
      {success && <div className="bg-green-950/40 border border-green-800 text-green-200 px-4 py-3 rounded text-sm text-center">{success}</div>}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg flex items-center space-x-4">
          <div className="p-3 bg-blue-950/60 rounded-full text-[#2563EB]"><Users /></div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase">TOTAL USERS</div>
            <div className="text-xl font-bold text-white">{stats.totalUsers}</div>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg flex items-center space-x-4">
          <div className="p-3 bg-green-950/60 rounded-full text-[#22C55E]"><Activity /></div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase">TRADES COUNT</div>
            <div className="text-xl font-bold text-white">{stats.totalTradesCount}</div>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg flex items-center space-x-4">
          <div className="p-3 bg-purple-950/60 rounded-full text-purple-400"><Database /></div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase">ACCUMULATED VOLUME</div>
            <div className="text-xl font-bold text-white">${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg flex items-center space-x-4">
          <div className="p-3 bg-yellow-950/60 rounded-full text-yellow-500"><AlertTriangle /></div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase">FEES REVENUE</div>
            <div className="text-xl font-bold text-white">${stats.totalFeesCollected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: User Admin & Withdrawal Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users lists */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <span className="text-sm font-bold text-white">Registered Exchange Users</span>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-400">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] uppercase text-gray-500">
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Created Date</th>
                  <th className="py-2 text-right">Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 font-mono">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-800/10">
                    <td className="py-3 font-sans text-white font-semibold">{u.email}</td>
                    <td className="py-3 font-sans">{u.role}</td>
                    <td className="py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleToggleFreeze(u.id)}
                        className={`px-3 py-1 rounded text-[10px] font-bold font-sans ${u.isFrozen ? 'bg-green-950 text-green-400 hover:bg-green-900' : 'bg-red-950 text-red-400 hover:bg-red-900'}`}
                      >
                        {u.isFrozen ? 'UNFREEZE' : 'FREEZE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Withdrawal Requests approvals list */}
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <span className="text-sm font-bold text-white">Withdrawal Verification Escrow Queue</span>
          
          <div className="space-y-4 overflow-y-auto max-h-[300px]">
            {withdrawals.length > 0 ? (
              withdrawals.map(w => (
                <div key={w.id} className="bg-gray-950 p-3 rounded space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-bold">{w.wallet?.user?.email || 'Unknown User'}</span>
                    <span className="bg-gray-800 px-2 py-0.5 rounded font-bold text-white text-[10px]">
                      {w.wallet?.coinSymbol || ''}
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-400 font-mono space-y-1">
                    <div>Net Amount: {parseFloat(w.amount).toFixed(4)} {w.wallet?.coinSymbol || ''}</div>
                    <div>Fee Collected: {parseFloat(w.fee).toFixed(4)} {w.wallet?.coinSymbol || ''}</div>
                    <div className="truncate">Destination: {w.address}</div>
                  </div>

                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={() => handleReviewWithdrawal(w.id, 'APPROVE')}
                      className="flex-1 bg-green-900 hover:bg-green-800 text-white font-bold py-1.5 rounded text-[10px] flex items-center justify-center space-x-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleReviewWithdrawal(w.id, 'REJECT')}
                      className="flex-1 bg-red-900 hover:bg-red-800 text-white font-bold py-1.5 rounded text-[10px] flex items-center justify-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-xs text-gray-500">No withdrawal requests requiring manual review</div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Terminal */}
      <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
        <span className="text-sm font-bold text-white">Security & Audit Event Trail Logs</span>
        
        <div className="overflow-x-auto max-h-[300px]">
          <table className="w-full text-left text-xs text-gray-400">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] uppercase text-gray-500">
                <th className="py-2">Timestamp</th>
                <th className="py-2">Trigger User</th>
                <th className="py-2">Action</th>
                <th className="py-2">IP Address</th>
                <th className="py-2">Metadata Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30 font-mono text-[10px]">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-800/10">
                  <td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-2 font-sans">{log.user?.email || 'SYSTEM / ANONYMOUS'}</td>
                  <td className="py-2 font-bold text-gray-300">{log.action}</td>
                  <td className="py-2">{log.ipAddress}</td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
