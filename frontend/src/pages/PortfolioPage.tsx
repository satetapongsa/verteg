import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';

interface Balance {
  id: string;
  coinSymbol: string;
  balance: string;
  locked: string;
}

export const PortfolioPage: React.FC = () => {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({
    BTC: 65200, ETH: 3450, BNB: 590, SOL: 145, USDT: 1.0,
    XRP: 0.52, DOGE: 0.12, ADA: 0.45, TRX: 0.11, MATIC: 0.68
  });
  const [loading, setLoading] = useState(true);

  // Mock historical performance values
  const performanceData = [
    { date: 'Jun 13', value: 12400 },
    { date: 'Jun 14', value: 12800 },
    { date: 'Jun 15', value: 12500 },
    { date: 'Jun 16', value: 13200 },
    { date: 'Jun 17', value: 13900 },
    { date: 'Jun 18', value: 14500 },
    { date: 'Jun 19', value: 15300 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const balRes = await api.get('/wallet/balances');
        setBalances(balRes.data);

        // Fetch latest prices for accurate calculations
        const mockPrices = { ...prices };
        const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
        await Promise.all(symbols.map(async (s) => {
          try {
            const res = await api.get(`/trade/orderbook/${s}_USDT`);
            if (res.data.asks[0]?.price) {
              mockPrices[s] = res.data.asks[0].price;
            }
          } catch {
            // fallback
          }
        }));
        setPrices(mockPrices);
      } catch (err) {
        console.error('Failed to load portfolio statistics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalValue = balances.reduce((sum, bal) => {
    const totalAmt = parseFloat(bal.balance) + parseFloat(bal.locked);
    return sum + (totalAmt * (prices[bal.coinSymbol] || 0));
  }, 0);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading portfolio analytics...</div>;
  }

  return (
    <div className="bg-[#0A0E17] min-h-[90vh] text-gray-100 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Portfolio Headline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-2">
          <span className="text-xs font-semibold text-gray-400">NET ASSET VALUE (NAV)</span>
          <div className="text-2xl font-extrabold text-white">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[#22C55E] text-xs font-semibold flex items-center space-x-1">
            <ArrowUpRight className="w-4.5 h-4.5" />
            <span>+$2,140.20 (+16.24%) All Time</span>
          </span>
        </div>

        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-2">
          <span className="text-xs font-semibold text-gray-400">TOTAL INVESTED</span>
          <div className="text-2xl font-extrabold text-white">
            ${(totalValue * 0.85).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-gray-400 text-xs">Cost Basis Reference</span>
        </div>

        <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-2">
          <span className="text-xs font-semibold text-gray-400">RETURNS INDEX</span>
          <div className="text-2xl font-extrabold text-[#22C55E]">
            +${(totalValue * 0.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-green-400 font-bold">ROI: +17.65%</span>
        </div>
      </div>

      {/* Chart: NAV Performance over time */}
      <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
        <span className="text-sm font-semibold text-white">Net Asset Value (NAV) Performance Chart</span>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickLine={false} />
              <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Holdings distribution table */}
      <div className="bg-[#111827] border border-gray-800 p-6 rounded-lg space-y-4">
        <span className="text-sm font-semibold text-white">Individual Holdings Breakdowns</span>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="py-2">Asset</th>
                <th className="py-2 text-right">Available Amount</th>
                <th className="py-2 text-right">Locked Amount</th>
                <th className="py-2 text-right">Market Price</th>
                <th className="py-2 text-right">Portfolio Value</th>
                <th className="py-2 text-right">Alloc %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40 text-xs font-mono">
              {balances.map(bal => {
                const price = prices[bal.coinSymbol] || 1;
                const totalAmt = parseFloat(bal.balance) + parseFloat(bal.locked);
                const assetVal = totalAmt * price;
                const allocPct = totalValue > 0 ? (assetVal / totalValue) * 100 : 0;
                
                if (totalAmt <= 0) return null;

                return (
                  <tr key={bal.id} className="hover:bg-gray-800/20">
                    <td className="py-3 font-sans font-bold text-white flex items-center space-x-2">
                      <img 
                        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${bal.coinSymbol.toLowerCase()}.png`} 
                        alt={bal.coinSymbol}
                        className="w-5 h-5"
                        onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'; }}
                      />
                      <span className="bg-gray-800 text-white font-bold px-2 py-0.5 rounded text-[10px]">{bal.coinSymbol}</span>
                    </td>
                    <td className="py-3 text-right text-gray-300">{parseFloat(bal.balance).toFixed(6)}</td>
                    <td className="py-3 text-right text-yellow-500">{parseFloat(bal.locked).toFixed(6)}</td>
                    <td className="py-3 text-right text-white">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="py-3 text-right text-white font-bold">${assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right text-[#2563EB] font-bold font-sans">{allocPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {balances.filter(b => parseFloat(b.balance) + parseFloat(b.locked) > 0).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-gray-500 font-sans">No assets currently held. Go to Wallets page to simulate a deposit.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
