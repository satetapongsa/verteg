import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useWebSocket } from '../context/WebSocketContext';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Copy, Check, Info, RefreshCw, QrCode } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';

interface WalletAsset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  locked: number;
  address: string;
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  symbol: string;
  amount: number;
  fee: number;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export const WalletPage: React.FC = () => {
  const { subscribe } = useWebSocket();
  
  const [wallets, setWallets] = useState<WalletAsset[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCoin, setActiveCoin] = useState<WalletAsset | null>(null);

  // Tab selections
  const [actionTab, setActionTab] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');

  // Deposit Actions
  const [depositAmount, setDepositAmount] = useState('1.0');
  const [depositLoading, setDepositLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Withdrawal Actions
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const walletsRes = await api.get('/wallet/balances');
      const walletsList: WalletAsset[] = walletsRes.data.wallets;
      setWallets(walletsList);

      // Keep active coin reference stable
      if (activeCoin) {
        const updated = walletsList.find((w) => w.symbol === activeCoin.symbol);
        if (updated) setActiveCoin(updated);
      } else if (walletsList.length > 0) {
        setActiveCoin(walletsList[0]);
      }

      const historyRes = await api.get('/wallet/history');
      setHistory(historyRes.data.history);
    } catch (err) {
      console.error('Error fetching wallet balance details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Re-trigger balance update on socket triggers
    const unsubscribe = subscribe('user:updates', () => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, [activeCoin?.symbol]);

  const handleCopyAddress = () => {
    if (!activeCoin) return;
    navigator.clipboard.writeText(activeCoin.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMockDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCoin) return;
    
    setDepositLoading(true);
    try {
      await api.post('/wallet/deposit-mock', {
        symbol: activeCoin.symbol,
        amount: depositAmount,
      });
      await fetchData();
    } catch (err) {
      console.error('Mock deposit fail:', err);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCoin) return;

    setError(null);
    setSuccessMsg(null);

    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!withdrawAddress.trim()) {
      setError('Please enter a destination address');
      return;
    }

    setWithdrawLoading(true);
    try {
      const res = await api.post('/wallet/withdraw', {
        symbol: activeCoin.symbol,
        amount: withdrawAmount,
        address: withdrawAddress,
      });
      setSuccessMsg(res.data.message);
      setWithdrawAmount('');
      setWithdrawAddress('');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Withdrawal request failed.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <div className="w-12 h-12 border-4 border-accentBlue border-t-transparent rounded-full animate-spin"></div>
          <span className="text-textMuted text-sm">Synchronizing wallets...</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* Assets List Card */}
          <div className="bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg md:col-span-1">
            <div className="p-4 border-b border-darkGray bg-gray-900/20 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-4.5 w-4.5 text-accentBlue" /> Assets Portfolio
              </h3>
              <button
                onClick={fetchData}
                className="p-1 hover:bg-darkGray rounded-lg text-textMuted hover:text-white transition-colors"
                title="Refresh Balances"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-darkGray max-h-[60vh] overflow-y-auto">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveCoin(w);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`w-full p-4 flex items-center justify-between text-left hover:bg-darkGray/25 transition-colors ${
                    activeCoin?.symbol === w.symbol ? 'bg-darkGray/40 border-l-4 border-accentBlue' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CoinIcon symbol={w.symbol} size={28} />
                    <div>
                      <span className="font-bold text-white block leading-none">{w.symbol}</span>
                      <span className="text-textMuted text-[10px] mt-1 block">{w.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm block">
                      {w.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-textMuted text-xs block">
                      Locked: {w.locked.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Core Actions Panel */}
          {activeCoin && (
            <div className="md:col-span-2 space-y-6">
              {/* Asset Header Info */}
              <div className="bg-card border border-darkGray p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
                <div className="flex items-center space-x-3">
                  <CoinIcon symbol={activeCoin.symbol} size={36} />
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-black text-white">{activeCoin.symbol}</span>
                      <span className="bg-darkGray border border-gray-700 px-2.5 py-0.5 rounded text-xs text-textMuted font-bold uppercase">
                        {activeCoin.network} Network
                      </span>
                    </div>
                    <p className="text-textMuted text-xs font-semibold">{activeCoin.name}</p>
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-textMuted text-xs block">Available Balance</span>
                  <span className="text-3xl font-black tracking-tight text-white">
                    {activeCoin.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                  </span>
                </div>
              </div>

              {/* Deposit / Withdrawal Form Segment */}
              <div className="bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg">
                {/* Tabs selection header */}
                <div className="flex border-b border-darkGray bg-gray-900/20">
                  <button
                    onClick={() => {
                      setActionTab('DEPOSIT');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className={`flex-1 py-4 text-center font-bold text-sm transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                      actionTab === 'DEPOSIT'
                        ? 'border-accentBlue text-white bg-darkGray/10'
                        : 'border-transparent text-textMuted hover:text-white'
                    }`}
                  >
                    <ArrowDownCircle className="h-4.5 w-4.5 text-successGreen" /> Deposit
                  </button>
                  <button
                    onClick={() => {
                      setActionTab('WITHDRAWAL');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className={`flex-1 py-4 text-center font-bold text-sm transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                      actionTab === 'WITHDRAWAL'
                        ? 'border-accentBlue text-white bg-darkGray/10'
                        : 'border-transparent text-textMuted hover:text-white'
                    }`}
                  >
                    <ArrowUpCircle className="h-4.5 w-4.5 text-orange-400" /> Withdraw
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {actionTab === 'DEPOSIT' ? (
                    <div className="space-y-6">
                      <div className="grid sm:grid-cols-3 gap-6 items-center">
                        {/* QR Code generator */}
                        <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 max-w-[170px] mx-auto">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=0a0e17&data=${activeCoin.address}`}
                            alt="QR Address"
                            className="w-36 h-36"
                          />
                        </div>

                        {/* Copy details */}
                        <div className="sm:col-span-2 space-y-4 text-center sm:text-left">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">Deposit Address</span>
                            <div className="flex items-center gap-2 bg-background border border-darkGray p-3 rounded-lg">
                              <span className="text-xs break-all font-mono font-bold text-white flex-grow selection:bg-blue-900">
                                {activeCoin.address}
                              </span>
                              <button
                                onClick={handleCopyAddress}
                                className="p-2 bg-darkGray hover:bg-gray-700 text-textMuted hover:text-white rounded-lg transition-colors shrink-0"
                                title="Copy Address"
                              >
                                {copied ? <Check className="h-4.5 w-4.5 text-successGreen" /> : <Copy className="h-4.5 w-4.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-start space-x-2 bg-blue-950/20 border border-blue-900/40 text-blue-400 p-3 rounded-lg text-xs leading-normal text-left">
                            <Info className="h-4.5 w-4.5 shrink-0" />
                            <span>
                              Send only <strong>{activeCoin.symbol}</strong> to this address. Sending other coins may result in permanent loss. Transactions require blockchain sync approval.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mock Deposit Simulator */}
                      <form onSubmit={handleMockDeposit} className="border-t border-darkGray pt-6 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted">Developer Mock Deposit Tool</h4>
                          <p className="text-[11px] text-textMuted leading-tight">
                            Simulate incoming blockchain deposit to credit mock balances.
                          </p>
                        </div>
                        <div className="flex gap-3 max-w-md">
                          <input
                            type="number"
                            step="any"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="flex-grow bg-background border border-darkGray focus:border-accentBlue px-4 py-2.5 rounded-lg text-sm outline-none font-bold"
                          />
                          <button
                            type="submit"
                            disabled={depositLoading}
                            className="bg-successGreen hover:bg-green-600 disabled:bg-green-700 text-white px-5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {depositLoading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              'Simulate Deposit'
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <form onSubmit={handleWithdrawalSubmit} className="space-y-5">
                      {error && (
                        <div className="bg-red-950/20 border border-red-900/40 text-red-400 p-3.5 rounded-lg text-xs flex items-center gap-1.5">
                          <Info className="h-4.5 w-4.5 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {successMsg && (
                        <div className="bg-green-950/20 border border-green-900/40 text-successGreen p-3.5 rounded-lg text-xs flex items-center gap-1.5">
                          <Info className="h-4.5 w-4.5 shrink-0" />
                          <span>{successMsg}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Destination Address</label>
                        <input
                          type="text"
                          required
                          value={withdrawAddress}
                          onChange={(e) => setWithdrawAddress(e.target.value)}
                          placeholder={`Enter destination ${activeCoin.symbol} wallet address`}
                          className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 px-4 rounded-lg text-sm outline-none font-mono"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Amount to Withdraw</label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 px-4 rounded-lg text-sm outline-none font-bold"
                          />
                        </div>

                        <div className="space-y-1 bg-background border border-darkGray p-3 rounded-lg flex flex-col justify-center text-xs">
                          <div className="flex justify-between">
                            <span className="text-textMuted">Transaction Fee:</span>
                            <span className="font-bold">{activeCoin.symbol === 'BTC' ? '0.0005' : '1.0'} {activeCoin.symbol}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-textMuted">Net Received:</span>
                            <span className="font-bold text-white">
                              {Math.max(0, (parseFloat(withdrawAmount) || 0) - (activeCoin.symbol === 'BTC' ? 0.0005 : 1.0)).toFixed(4)} {activeCoin.symbol}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={withdrawLoading}
                        className="w-full bg-accentBlue hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg shadow-lg flex items-center justify-center space-x-2 transition-all"
                      >
                        {withdrawLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>Submit Withdrawal Request</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Transactions History List */}
              <div className="bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-darkGray bg-gray-900/20">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Transaction Records</h3>
                </div>
                {history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-semibold">
                      <thead>
                        <tr className="border-b border-darkGray bg-gray-900/10 text-textMuted uppercase">
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Asset</th>
                          <th className="px-6 py-3 text-right">Amount</th>
                          <th className="px-6 py-3 text-right">Fee</th>
                          <th className="px-6 py-3">TxHash</th>
                          <th className="px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-darkGray">
                        {history.map((tx) => (
                          <tr key={tx.id} className="hover:bg-darkGray/10 transition-colors">
                            <td className="px-6 py-3 text-textMuted">{new Date(tx.createdAt).toLocaleString()}</td>
                            <td className={`px-6 py-3 font-bold ${tx.type === 'DEPOSIT' ? 'text-successGreen' : 'text-orange-400'}`}>
                              {tx.type}
                            </td>
                            <td className="px-6 py-3">{tx.symbol}</td>
                            <td className="px-6 py-3 text-right font-bold">{tx.amount.toFixed(4)}</td>
                            <td className="px-6 py-3 text-right text-textMuted">{tx.fee.toFixed(4)}</td>
                            <td className="px-6 py-3 font-mono text-[10px] text-textMuted select-text">
                              {tx.txHash ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-8)}` : 'Awaiting Approval'}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                tx.status === 'COMPLETED' ? 'bg-green-950/40 text-successGreen border border-green-900/40' :
                                tx.status === 'PENDING' ? 'bg-yellow-950/40 text-yellow-500 border border-yellow-900/40' :
                                'bg-red-950/40 text-errorRed border border-red-900/40'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-textMuted">No wallet transactions found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
