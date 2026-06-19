import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Wallet, QrCode, ArrowDownRight, ArrowUpRight, Copy, CheckCircle, RefreshCw } from 'lucide-react';

interface Balance {
  id: string;
  coinSymbol: string;
  balance: string;
  locked: string;
  address: string;
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: string;
  fee: string;
  network: string;
  address: string;
  txHash: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  createdAt: string;
}

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Deposit state
  const [depositCoin, setDepositCoin] = useState('BTC');
  const [depositAddress, setDepositAddress] = useState('');
  const [depositQr, setDepositQr] = useState('');
  const [copied, setCopied] = useState(false);

  // Withdraw state
  const [withdrawCoin, setWithdrawCoin] = useState('BTC');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  // Sandbox State
  const [sandboxCoin, setSandboxCoin] = useState('BTC');
  const [sandboxAmount, setSandboxAmount] = useState('1.5');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWalletData = async () => {
    try {
      const balRes = await api.get('/wallet/balances');
      setBalances(balRes.data);

      const txRes = await api.get('/wallet/transactions');
      setTransactions(txRes.data);
    } catch (err: any) {
      setError('Failed to fetch wallet balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  // Fetch deposit address when coin changes
  useEffect(() => {
    const fetchDepositAddress = async () => {
      if (!balances.length) return;
      try {
        const res = await api.get(`/wallet/deposit/${depositCoin}`);
        setDepositAddress(res.data.address);
        setDepositQr(res.data.qrCodeUrl);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepositAddress();
  }, [depositCoin, balances]);

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/wallet/withdraw', {
        coinSymbol: withdrawCoin,
        amount: parseFloat(withdrawAmount),
        destinationAddress: withdrawAddress,
        twoFactorCode: user?.twoFactorEnabled ? twoFactorCode : undefined
      });
      setSuccess('Withdrawal request successfully queued for admin approval.');
      setWithdrawAmount('');
      setWithdrawAddress('');
      setTwoFactorCode('');
      fetchWalletData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Withdrawal failed');
    }
  };

  const handleSimulateDeposit = async () => {
    setError('');
    setSuccess('');
    try {
      await api.post('/wallet/simulate-deposit', {
        coinSymbol: sandboxCoin,
        amount: parseFloat(sandboxAmount)
      });
      setSuccess(`Successfully simulated deposit of ${sandboxAmount} ${sandboxCoin}! Balance updated.`);
      fetchWalletData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Deposit simulation failed');
    }
  };

  const getWithdrawalFee = (coin: string): number => {
    const fees: Record<string, number> = {
      BTC: 0.0005, ETH: 0.005, USDT: 1.0, BNB: 0.001, SOL: 0.01,
      XRP: 0.25, DOGE: 1.0, ADA: 1.0, TRX: 1.0, MATIC: 1.0
    };
    return fees[coin] || 0.01;
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading digital wallets...</div>;
  }

  return (
    <div className="bg-[#0A0E17] min-h-[90vh] text-gray-100 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Alert Notifications */}
      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-200 px-4 py-3 rounded text-sm text-center">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-950/40 border border-green-800 text-green-200 px-4 py-3 rounded text-sm text-center">
          {success}
        </div>
      )}

      {/* Grid of Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances List */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <span className="text-sm font-bold text-white flex items-center space-x-2">
              <Wallet className="text-[#2563EB] w-5 h-5" />
              <span>Wallet Balances</span>
            </span>
            <button onClick={fetchWalletData} className="text-xs text-gray-400 hover:text-white flex items-center space-x-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Balances</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="py-2">Asset</th>
                  <th className="py-2 text-right">Available Balance</th>
                  <th className="py-2 text-right">Locked (Escrow)</th>
                  <th className="py-2 text-right">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 font-mono text-xs">
                {balances.map((bal) => {
                  const total = parseFloat(bal.balance) + parseFloat(bal.locked);
                  return (
                    <tr key={bal.id} className="hover:bg-gray-800/20">
                      <td className="py-3 font-sans font-bold text-white flex items-center space-x-2">
                        <img 
                          src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${bal.coinSymbol.toLowerCase()}.png`} 
                          alt={bal.coinSymbol}
                          className="w-5 h-5"
                          onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'; }}
                        />
                        <span>{bal.coinSymbol}</span>
                      </td>
                      <td className="py-3 text-right text-green-400">{parseFloat(bal.balance).toFixed(6)}</td>
                      <td className="py-3 text-right text-yellow-500">{parseFloat(bal.locked).toFixed(6)}</td>
                      <td className="py-3 text-right text-white font-bold">{total.toFixed(6)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mock Sandbox Deposit Simulator */}
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <span className="text-xs font-semibold text-gray-400 tracking-wider">SANDBOX DEPOSIT SIMULATOR</span>
          <p className="text-xs text-gray-400">
            Select a coin type and write any amount to simulate incoming blockchain confirmation deposits.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-gray-400">Select Asset</label>
              <select
                value={sandboxCoin}
                onChange={(e) => setSandboxCoin(e.target.value)}
                className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]"
              >
                {balances.map(b => (
                  <option key={b.coinSymbol} value={b.coinSymbol}>{b.coinSymbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-gray-400">Deposit Amount</label>
              <input
                type="number"
                value={sandboxAmount}
                onChange={(e) => setSandboxAmount(e.target.value)}
                className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              onClick={handleSimulateDeposit}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-2 rounded text-xs transition-all"
            >
              Trigger Network Confirmation
            </button>
          </div>
        </div>
      </div>

      {/* Deposit & Withdrawal Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit Panel */}
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <span className="text-xs font-semibold text-gray-400 tracking-wider">DEPOSIT CRYPTOCURRENCY</span>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-gray-400">Coin</label>
                <select
                  value={depositCoin}
                  onChange={(e) => setDepositCoin(e.target.value)}
                  className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {balances.map(b => (
                    <option key={b.coinSymbol} value={b.coinSymbol}>{b.coinSymbol}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Select Network</label>
                <div className="bg-[#1F2937] border border-gray-800 p-3 rounded text-xs text-white font-semibold">
                  {depositCoin === 'BTC' ? 'Bitcoin Mainnet' : ['ETH', 'USDT', 'MATIC'].includes(depositCoin) ? 'Ethereum (ERC20)' : depositCoin === 'BNB' ? 'BNB Smart Chain (BEP20)' : depositCoin === 'SOL' ? 'Solana Mainnet' : 'Tron (TRC20)'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">Your Deposit Address</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={depositAddress}
                    className="w-full bg-[#1F2937] border border-gray-800 rounded px-3 py-2 text-[10px] font-mono text-gray-300 focus:outline-none"
                  />
                  <button onClick={handleCopy} className="bg-gray-800 hover:bg-gray-700 p-2 rounded">
                    {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center bg-white p-4 rounded-lg w-40 h-40 mx-auto">
              {depositQr ? (
                <img src={depositQr} alt="QR Deposit" className="w-32 h-32" />
              ) : (
                <QrCode className="w-16 h-16 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Withdrawal Panel */}
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
          <span className="text-xs font-semibold text-gray-400 tracking-wider">SECURE WITHDRAWAL TERMINAL</span>
          
          <form onSubmit={handleWithdrawal} className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-gray-400">Coin</label>
                <select
                  value={withdrawCoin}
                  onChange={(e) => setWithdrawCoin(e.target.value)}
                  className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {balances.map(b => (
                    <option key={b.coinSymbol} value={b.coinSymbol}>{b.coinSymbol}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400">Select Network</label>
                <select className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none">
                  <option>Standard Crypto Network</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-400">Destination Address</label>
              <input
                type="text"
                required
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="Enter valid deposit address"
                className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-gray-400">Amount</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex flex-col justify-end text-right px-2">
                <span className="text-[10px] text-gray-500">Fee: {getWithdrawalFee(withdrawCoin)} {withdrawCoin}</span>
                <span className="text-xs font-bold text-white">
                  Total: {withdrawAmount ? (parseFloat(withdrawAmount) + getWithdrawalFee(withdrawCoin)).toFixed(6) : '0.00'} {withdrawCoin}
                </span>
              </div>
            </div>

            {user?.twoFactorEnabled && (
              <div>
                <label className="text-[11px] text-gray-400">Google 2FA Code</label>
                <input
                  type="text"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full bg-[#1F2937] border border-gray-700 rounded px-3 py-2 text-sm text-center text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-2 rounded text-xs transition-all"
            >
              Request Withdrawal Approval
            </button>
          </form>
        </div>
      </div>

      {/* Transaction History Logs */}
      <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
        <span className="text-xs font-semibold text-gray-400 tracking-wider">TRANSACTION LEDGER HISTORY</span>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="py-2">TX ID</th>
                <th className="py-2">Type</th>
                <th className="py-2">Network</th>
                <th className="py-2">Destination/Deposit Address</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Fee</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40 text-xs font-mono">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/20">
                    <td className="py-3 text-[10px] text-gray-500">{tx.id.slice(0, 18)}...</td>
                    <td className={`py-3 font-sans font-bold ${tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}`}>{tx.type}</td>
                    <td className="py-3 font-sans">{tx.network}</td>
                    <td className="py-3 text-[10px] text-gray-400">{tx.address.slice(0, 24)}...</td>
                    <td className="py-3 text-right text-white font-bold">{parseFloat(tx.amount).toFixed(4)}</td>
                    <td className="py-3 text-right text-gray-400">{parseFloat(tx.fee).toFixed(4)}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-sans font-bold ${tx.status === 'COMPLETED' ? 'bg-green-950 text-[#22C55E]' : tx.status === 'PENDING' ? 'bg-yellow-950 text-yellow-500' : 'bg-red-950 text-[#EF4444]'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-gray-500 font-sans">No deposits or withdrawals captured on ledger</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
