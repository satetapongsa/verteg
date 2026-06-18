import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useWebSocket } from '../context/WebSocketContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Wallet, DollarSign, TrendingUp, TrendingDown, RefreshCw, Layers } from 'lucide-react';
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

interface MarketData {
  symbol: string;
  name: string;
  lastPrice: number;
  high: number;
  low: number;
  volume: number;
  priceChangePercent: number;
}

interface Trade {
  id: string;
  symbol: string;
  price: number;
  amount: number;
  createdAt: string;
}

export const PortfolioPage: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [wallets, setWallets] = useState<WalletAsset[]>([]);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const walletsRes = await api.get('/wallet/balances');
      setWallets(walletsRes.data.wallets);

      const marketsRes = await api.get('/market/overview');
      setMarkets(marketsRes.data.markets);

      const tradesRes = await api.get('/trade/trades');
      setTrades(tradesRes.data.trades);
    } catch (err) {
      console.error('Error fetching portfolio metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = subscribe('user:updates', () => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getAssetPrice = (symbol: string): number => {
    if (symbol === 'USDT') return 1.0;
    const market = markets.find((m) => m.symbol === `${symbol}/USDT`);
    return market ? market.lastPrice : 0;
  };

  // Calculations for cost basis, current valuations, and ROI
  const holdings = wallets.map((w) => {
    const currentPrice = getAssetPrice(w.symbol);
    const totalAmount = w.balance + w.locked;
    const currentValue = totalAmount * currentPrice;

    // Filter trades relating to this asset to compute simulated cost basis
    const assetTrades = trades.filter((t) => t.symbol.startsWith(w.symbol));
    let totalCost = 0;
    let totalQuantityTraded = 0;
    let avgBuyPrice = currentPrice;

    assetTrades.forEach((t) => {
      totalCost += t.amount * t.price;
      totalQuantityTraded += t.amount;
    });

    if (totalQuantityTraded > 0) {
      avgBuyPrice = totalCost / totalQuantityTraded;
    } else {
      // Default fallback cost basis if user hasn't traded it (e.g. deposited)
      avgBuyPrice = currentPrice * 0.95; // Assume 5% profit for display
    }

    const costBasis = totalAmount * avgBuyPrice;
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    return {
      symbol: w.symbol,
      name: w.name,
      amount: totalAmount,
      currentPrice,
      currentValue,
      avgBuyPrice,
      costBasis,
      pnl,
      pnlPercent,
    };
  }).filter((h) => h.amount > 0);

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalPnl = totalPortfolioValue - totalCostBasis;
  const totalPnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  // Render analytics charts showing valuation of top holds
  const barChartData = holdings
    .filter((h) => h.symbol !== 'USDT')
    .map((h) => ({
      name: h.symbol,
      Value: parseFloat(h.currentValue.toFixed(2)),
      Cost: parseFloat(h.costBasis.toFixed(2)),
    }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <div className="w-12 h-12 border-4 border-accentBlue border-t-transparent rounded-full animate-spin"></div>
          <span className="text-textMuted text-sm">Analyzing portfolio metrics...</span>
        </div>
      ) : (
        <>
          {/* Portfolio Stats Panels */}
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-card border border-darkGray p-6 rounded-xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Total Portfolio</span>
                <span className="text-2xl font-black block">
                  ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Wallet className="h-9 w-9 text-accentBlue" />
            </div>

            <div className="bg-card border border-darkGray p-6 rounded-xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Net Profit / Loss</span>
                <span className={`text-2xl font-black block ${totalPnl >= 0 ? 'text-successGreen' : 'text-errorRed'}`}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {totalPnl >= 0 ? <TrendingUp className="h-9 w-9 text-successGreen" /> : <TrendingDown className="h-9 w-9 text-errorRed" />}
            </div>

            <div className="bg-card border border-darkGray p-6 rounded-xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Total Return (ROI)</span>
                <span className={`text-2xl font-black block ${totalPnlPercent >= 0 ? 'text-successGreen' : 'text-errorRed'}`}>
                  {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                </span>
              </div>
              <DollarSign className="h-9 w-9 text-purple-500" />
            </div>
          </div>

          {/* Analytics Chart Row */}
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Holdings Distribution list */}
            <div className="md:col-span-2 bg-card border border-darkGray rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-darkGray bg-gray-900/20 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-accentBlue" /> Account Holdings
                </h3>
                <button
                  onClick={fetchData}
                  className="p-1.5 hover:bg-darkGray rounded-lg text-textMuted hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              {holdings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-semibold">
                    <thead>
                      <tr className="border-b border-darkGray bg-gray-900/10 text-textMuted uppercase">
                        <th className="px-6 py-4">Asset</th>
                        <th className="px-6 py-4 text-right">Holdings</th>
                        <th className="px-6 py-4 text-right">Current Price</th>
                        <th className="px-6 py-4 text-right">Acquisition Cost</th>
                        <th className="px-6 py-4 text-right">Market Value</th>
                        <th className="px-6 py-4 text-right">Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkGray">
                      {holdings.map((h) => {
                        const isProfit = h.pnl >= 0;
                        return (
                          <tr key={h.symbol} className="hover:bg-darkGray/10 transition-colors">
                            <td className="px-6 py-4 flex items-center space-x-3">
                              <CoinIcon symbol={h.symbol} size={24} />
                              <div>
                                <span className="text-white text-sm font-bold block leading-none">{h.symbol}</span>
                                <span className="text-textMuted text-[10px] mt-0.5 block">{h.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-bold">
                              {h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </td>
                            <td className="px-6 py-4 text-right text-textMuted">
                              ${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 text-right text-textMuted">
                              ${h.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 text-right text-white font-bold">
                              ${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`px-6 py-4 text-right font-bold ${isProfit ? 'text-successGreen' : 'text-errorRed'}`}>
                              <span className="block">{isProfit ? '+' : ''}{h.pnl.toFixed(2)}</span>
                              <span className="text-[10px] font-semibold">
                                {isProfit ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-textMuted">Your portfolio is currently empty.</div>
              )}
            </div>

            {/* Hold Valuation Comparison Recharts */}
            <div className="md:col-span-1 bg-card border border-darkGray p-6 rounded-xl shadow-lg space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted">Value vs Cost Basis</h4>
              <div className="h-64 w-full">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#fff' }}
                      />
                      <Bar dataKey="Value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Cost" fill="#6B7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-textMuted">No metrics to display</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
