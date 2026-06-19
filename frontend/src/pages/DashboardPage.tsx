import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, ArrowDownRight, ArrowUpRight, Clock, Percent } from 'lucide-react';

interface Balance {
  id: string;
  coinSymbol: string;
  balance: string;
  locked: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  coinSymbol: string; // resolved via wallet
  network: string;
  status: string;
  createdAt: string;
}

const COLORS = ['#2563EB', '#22C55E', '#A855F7', '#EAB308', '#EC4899', '#3B82F6', '#10B981', '#F97316'];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({
    BTC: 65200, ETH: 3450, BNB: 590, SOL: 145, USDT: 1.0,
    XRP: 0.52, DOGE: 0.12, ADA: 0.45, TRX: 0.11, MATIC: 0.68
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const balRes = await api.get('/wallet/balances');
        setBalances(balRes.data);

        const txRes = await api.get('/wallet/transactions');
        setTransactions(txRes.data.slice(0, 5));

        // Attempt fetching live values from memory engine books or fallback
        const mockPrices: Record<string, number> = { ...prices };
        const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
        await Promise.all(symbols.map(async (s) => {
          try {
            const res = await api.get(`/trade/orderbook/${s}_USDT`);
            if (res.data.asks[0]?.price) {
              mockPrices[s] = res.data.asks[0].price;
            }
          } catch {
            // keep fallback
          }
        }));
        setPrices(mockPrices);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getPortfolioValue = () => {
    return balances.reduce((sum, bal) => {
      const price = prices[bal.coinSymbol] || 0;
      const totalAmt = parseFloat(bal.balance) + parseFloat(bal.locked);
      return sum + (totalAmt * price);
    }, 0);
  };

  const getChartData = () => {
    return balances
      .map(bal => {
        const total = parseFloat(bal.balance) + parseFloat(bal.locked);
        const value = total * (prices[bal.coinSymbol] || 0);
        return {
          name: bal.coinSymbol,
          value: parseFloat(value.toFixed(2))
        };
      })
      .filter(item => item.value > 0);
  };

  const portfolioValue = getPortfolioValue();
  const chartData = getChartData();

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading dashboard terminal...</div>;
  }

  return (
    <div className="bg-[#0A0E17] min-h-[90vh] text-gray-100 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Portfolio Value Headline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 p-6 rounded-lg flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 tracking-wider">ESTIMATED PORTFOLIO VALUE</span>
            <div className="text-3xl sm:text-4xl font-extrabold text-white">
              ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[#22C55E] text-xs font-semibold flex items-center space-x-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>+3.24% Profit (24h)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-800">
            <div>
              <span className="text-xs text-gray-400">Available Funds</span>
              <div className="text-lg font-bold text-white">
                ${balances.reduce((sum, b) => sum + (parseFloat(b.balance) * (prices[b.coinSymbol] || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Locked in Orders</span>
              <div className="text-lg font-bold text-yellow-500">
                ${balances.reduce((sum, b) => sum + (parseFloat(b.locked) * (prices[b.coinSymbol] || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Pie Chart */}
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg flex flex-col items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 mr-auto">ASSET ALLOCATION</span>
          
          <div className="w-full h-48 relative flex items-center justify-center">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500">No assets deposited yet</div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-[10px] mt-4">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center space-x-1 bg-gray-800 px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="text-gray-300 font-bold">{item.name}</span>
                <span className="text-white">({((item.value / (portfolioValue || 1)) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Tickers & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Markets */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Hot Crypto Assets</span>
            <Link to="/trade" className="text-xs text-[#2563EB] hover:underline font-semibold">Trade All Coins</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="py-2">Coin</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Change (24h)</th>
                  <th className="py-2 text-right">Available Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {balances.slice(0, 6).map((bal) => {
                  const currentPrice = prices[bal.coinSymbol] || 1;
                  const isPositive = bal.coinSymbol !== 'USDT';
                  return (
                    <tr key={bal.id} className="hover:bg-gray-800/20">
                      <td className="py-3 flex items-center space-x-2">
                        <img 
                          src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${bal.coinSymbol.toLowerCase()}.png`} 
                          alt={bal.coinSymbol}
                          className="w-5 h-5"
                          onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'; }}
                        />
                        <span className="bg-gray-800 text-white font-bold px-2 py-0.5 rounded text-xs">{bal.coinSymbol}</span>
                      </td>
                      <td className="py-3 text-right font-semibold text-white">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className={`py-3 text-right font-bold ${isPositive ? 'text-[#22C55E]' : 'text-gray-400'}`}>
                        {isPositive ? '+4.12%' : '0.00%'}
                      </td>
                      <td className="py-3 text-right text-white font-mono text-xs">
                        {parseFloat(bal.balance).toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Recent Transactions</span>
            <Link to="/wallet" className="text-xs text-[#2563EB] hover:underline font-semibold">Wallet Page</Link>
          </div>

          <div className="space-y-3">
            {transactions.length > 0 ? (
              transactions.map((tx) => {
                const isDeposit = tx.type === 'DEPOSIT';
                return (
                  <div key={tx.id} className="flex items-center justify-between p-2 hover:bg-gray-800/30 rounded">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-full ${isDeposit ? 'bg-green-950 text-[#22C55E]' : 'bg-red-950 text-[#EF4444]'}`}>
                        {isDeposit ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{tx.type}</div>
                        <div className="text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        {isDeposit ? '+' : '-'}{parseFloat(tx.amount).toFixed(4)}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">{tx.status}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-gray-500">No recent deposits or withdrawals</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
