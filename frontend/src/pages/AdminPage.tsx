import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { ShieldAlert, Users, TrendingUp, DollarSign, Ban, Unlock, Check, X, RefreshCw, BarChart } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  role: string;
  isFrozen: boolean;
  createdAt: string;
  kyc: {
    firstName: string;
    lastName: string;
    documentId: string;
    status: string;
  } | null;
}

interface PendingWithdrawal {
  id: string;
  email: string;
  symbol: string;
  address: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
}

interface SystemStats {
  totalUsers: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalRevenue: number;
  totalTrades: number;
  totalTradingVolume: number;
}

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Status/action loaders
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionWithdrawalId, setActionWithdrawalId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const usersRes = await api.get('/admin/users');
      setUsers(usersRes.data.users);

      const withdrawalsRes = await api.get('/admin/withdrawals');
      setWithdrawals(withdrawalsRes.data.withdrawals);

      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Failed to load admin panel data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleFreeze = async (userId: string, currentFreezeState: boolean) => {
    setActionUserId(userId);
    try {
      await api.post(`/admin/users/${userId}/freeze`, { freeze: !currentFreezeState });
      await fetchData();
    } catch (err) {
      console.error('Error toggling user freeze state:', err);
    } finally {
      setActionUserId(null);
    }
  };

  const handleWithdrawalDecision = async (id: string, decision: 'approve' | 'reject') => {
    setActionWithdrawalId(id);
    try {
      await api.post(`/admin/withdrawals/${id}/${decision}`);
      await fetchData();
    } catch (err) {
      console.error(`Error processing withdrawal ${decision}:`, err);
    } finally {
      setActionWithdrawalId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-darkGray pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-red-500 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" /> Vertex Core Administration
          </h2>
          <p className="text-textMuted text-sm">System oversight, account locks, withdrawal audits, and financial reporting.</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-darkGray hover:bg-gray-800 text-textMuted hover:text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all"
        >
          <RefreshCw className="h-4.5 w-4.5" /> Refresh Data
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-textMuted text-xs font-bold">Querying administrative logs...</span>
        </div>
      ) : (
        <>
          {/* Stats dashboard */}
          {stats && (
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-card border border-darkGray p-5 rounded-xl flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Registered Accounts</span>
                  <span className="text-2xl font-black text-white">{stats.totalUsers}</span>
                </div>
                <Users className="h-8 w-8 text-accentBlue" />
              </div>

              <div className="bg-card border border-darkGray p-5 rounded-xl flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Completed Trades</span>
                  <span className="text-2xl font-black text-white">{stats.totalTrades}</span>
                </div>
                <BarChart className="h-8 w-8 text-purple-500" />
              </div>

              <div className="bg-card border border-darkGray p-5 rounded-xl flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Total Volume Traded</span>
                  <span className="text-2xl font-black text-white">
                    ${stats.totalTradingVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <TrendingUp className="h-8 w-8 text-successGreen" />
              </div>

              <div className="bg-card border border-darkGray p-5 rounded-xl flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Accumulated Fees Revenue</span>
                  <span className="text-2xl font-black text-white">
                    ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          )}

          {/* Pending Withdrawals Card */}
          <div className="bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-darkGray bg-red-950/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">Awaiting Withdrawal Approvals</h3>
            </div>
            {withdrawals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-semibold">
                  <thead>
                    <tr className="border-b border-darkGray text-textMuted uppercase bg-gray-900/10">
                      <th className="px-6 py-3">Account</th>
                      <th className="px-6 py-3">Asset</th>
                      <th className="px-6 py-3">Destination Address</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-right">Fee</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkGray">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-darkGray/10">
                        <td className="px-6 py-3.5 text-white">{w.email}</td>
                        <td className="px-6 py-3.5">{w.symbol}</td>
                        <td className="px-6 py-3.5 font-mono text-[10px] text-textMuted select-all">{w.address}</td>
                        <td className="px-6 py-3.5 text-right font-bold">{w.amount.toFixed(4)}</td>
                        <td className="px-6 py-3.5 text-right text-textMuted">{w.fee.toFixed(4)}</td>
                        <td className="px-6 py-3.5 text-center flex justify-center space-x-2.5">
                          <button
                            onClick={() => handleWithdrawalDecision(w.id, 'approve')}
                            disabled={actionWithdrawalId === w.id}
                            className="bg-successGreen hover:bg-green-600 px-3 py-1.5 text-white font-bold rounded flex items-center gap-1 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleWithdrawalDecision(w.id, 'reject')}
                            disabled={actionWithdrawalId === w.id}
                            className="bg-errorRed hover:bg-red-600 px-3 py-1.5 text-white font-bold rounded flex items-center gap-1 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-textMuted">No pending withdrawal requests found.</div>
            )}
          </div>

          {/* User accounts block */}
          <div className="bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-darkGray bg-gray-900/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-textMuted">User Directory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-semibold">
                <thead>
                  <tr className="border-b border-darkGray text-textMuted uppercase bg-gray-900/10">
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">KYC Status</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-darkGray">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-darkGray/10">
                      <td className="px-6 py-3.5 font-mono text-[10px] text-textMuted select-all">{u.id}</td>
                      <td className="px-6 py-3.5 text-white font-bold">{u.email}</td>
                      <td className="px-6 py-3.5 text-textMuted uppercase">{u.role}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          u.kyc?.status === 'APPROVED' ? 'bg-green-950/40 text-successGreen border border-green-900/40' :
                          'bg-yellow-950/40 text-yellow-500 border border-yellow-900/40'
                        }`}>
                          {u.kyc ? u.kyc.status : 'UNSUBMITTED'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          u.isFrozen ? 'bg-red-950/40 text-errorRed border border-red-900/40 animate-pulse' : 'bg-green-950/40 text-successGreen'
                        }`}>
                          {u.isFrozen ? 'Frozen' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleFreeze(u.id, u.isFrozen)}
                          disabled={actionUserId === u.id || u.role === 'ADMIN'}
                          className={`px-3 py-1.5 text-white font-bold rounded inline-flex items-center gap-1.5 transition-colors ${
                            u.isFrozen 
                              ? 'bg-successGreen hover:bg-green-600' 
                              : 'bg-red-950/20 hover:bg-red-900/40 border border-red-900/60 text-red-400'
                          }`}
                        >
                          {u.isFrozen ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" /> Reactivate
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Freeze Account
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
