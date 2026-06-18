import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useWebSocket } from '../context/WebSocketContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, History, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
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

export const DashboardPage: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [wallets, setWallets] = useState<WalletAsset[]>([]);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const walletsRes = await api.get('/wallet/balances');
      setWallets(walletsRes.data.wallets);

      const marketsRes = await api.get('/market/overview');
      setMarkets(marketsRes.data.markets);

      const historyRes = await api.get('/wallet/history');
      setTransactions(historyRes.data.history.slice(0, 5)); // show top 5 recent transactions
    } catch (err) {
      console.error('Error fetching dashboard details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to portfolio updates via WebSocket
    const unsubscribe = subscribe('user:updates', () => {
      fetchData();
    });

    // Refresh pricing lists periodically
    const interval = setInterval(fetchData, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Map asset price values
  const getAssetPrice = (symbol: string): number => {
    if (symbol === 'USDT') return 1.0;
    const market = markets.find((m) => m.symbol === `${symbol}/USDT`);
    return market ? market.lastPrice : 0;
  };

  // Calculations
  const portfolioItems = wallets.map((w) => {
    const price = getAssetPrice(w.symbol);
    const value = (w.balance + w.locked) * price;
    return {
      symbol: w.symbol,
      name: w.name,
      amount: w.balance + w.locked,
      value,
    };
  }).filter((item) => item.amount > 0);

  const totalPortfolioValue = portfolioItems.reduce((sum, item) => sum + item.value, 0);

  // Sorting gainers and losers
  const topGainers = [...markets]
    .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    .slice(0, 3);

  const topLosers = [...markets]
    .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
    .slice(0, 3);

  const COLORS = ['#2563EB', '#22C55E', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <div className="w-12 h-12 border-4 border-accentBlue border-t-transparent rounded-full animate-spin"></div>
          <span className="text-textMuted text-sm">Synchronizing your dashboard...</span>
        </div>
      ) : (
        <>
          {/* Main Portfolio Row */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Portfolio Value Card */}
            <div className="bg-card border border-darkGray p-6 rounded-xl flex flex-col justify-between md:col-span-2 shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-textMuted">
                  <Wallet className="h-5 w-5 text-accentBlue" />
                  <span className="text-sm font-semibold tracking-wider uppercase">Estimated Portfolio Value</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                  ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <p className="text-xs text-textMuted">
                  Combined valuation across Spot and Locked trading accounts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-darkGray pt-6 mt-6">
                <div>
                  <span className="text-xs text-textMuted block mb-1">Spot Balance</span>
                  <span className="text-lg font-bold">
                    ${wallets
                      .reduce((sum, w) => sum + w.balance * getAssetPrice(w.symbol), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-textMuted block mb-1">In Open Orders</span>
                  <span className="text-lg font-bold text-accentBlue">
                    ${wallets
                      .reduce((sum, w) => sum + w.locked * getAssetPrice(w.symbol), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Asset Allocation Chart */}
            <div className="bg-card border border-darkGray p-6 rounded-xl flex flex-col justify-between shadow-lg">
              <h3 className="text-sm font-bold text-textMuted tracking-wider uppercase mb-4">Asset Allocation</h3>
              <div className="h-44 w-full relative">
                {portfolioItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioItems}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {portfolioItems.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#fff' }}
                        formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Allocated']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-textMuted">No assets held</div>
                )}
                {portfolioItems.length > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-textMuted uppercase font-bold">Crypto</span>
                    <span className="text-sm font-bold">{portfolioItems.length} Holds</span>
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap gap-2 mt-4 max-h-16 overflow-y-auto pr-1">
                {portfolioItems.map((item, idx) => (
                  <div key={item.symbol} className="flex items-center space-x-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span className="font-bold">{item.symbol}</span>
                    <span className="text-textMuted">({((item.value / totalPortfolioValue) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Markets, Gainers, Losers, Transactions Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Gainers & Losers */}
            <div className="space-y-6">
              {/* Gainers */}
              <div className="bg-card border border-darkGray p-5 rounded-xl space-y-4 shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-successGreen flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Top Gainers
                </h4>
                <div className="divide-y divide-darkGray">
                  {topGainers.map((g) => (
                    <div key={g.symbol} className="flex items-center justify-between py-2.5 text-sm font-semibold">
                      <div className="flex items-center space-x-2.5">
                        <CoinIcon symbol={g.symbol} size={24} />
                        <div>
                          <span className="text-white block leading-none">{g.symbol.split('/')[0]}</span>
                          <span className="text-[10px] text-textMuted font-normal mt-0.5 block">{g.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span>${g.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                        <span className="text-xs text-successGreen block flex items-center justify-end">
                          <ArrowUpRight className="h-3 w-3 inline" /> +{g.priceChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losers */}
              <div className="bg-card border border-darkGray p-5 rounded-xl space-y-4 shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-errorRed flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4" /> Top Losers
                </h4>
                <div className="divide-y divide-darkGray">
                  {topLosers.map((l) => (
                    <div key={l.symbol} className="flex items-center justify-between py-2.5 text-sm font-semibold">
                      <div className="flex items-center space-x-2.5">
                        <CoinIcon symbol={l.symbol} size={24} />
                        <div>
                          <span className="text-white block leading-none">{l.symbol.split('/')[0]}</span>
                          <span className="text-[10px] text-textMuted font-normal mt-0.5 block">{l.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span>${l.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                        <span className="text-xs text-errorRed block flex items-center justify-end">
                          <ArrowDownRight className="h-3 w-3 inline" /> {l.priceChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Transactions & Market Tickers */}
            <div className="md:col-span-2 space-y-6">
              {/* Market Overview */}
              <div className="bg-card border border-darkGray p-5 rounded-xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-accentBlue" /> Markets Overview
                  </h4>
                  <Link to="/trading" className="text-xs text-accentBlue hover:underline">Trade Markets</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {markets.slice(0, 6).map((m) => (
                    <Link
                      to="/trading"
                      key={m.symbol}
                      className="bg-background hover:bg-darkGray/40 border border-darkGray p-3.5 rounded-lg flex flex-col justify-between text-xs font-semibold hover:border-gray-700 transition-all"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center space-x-1.5">
                          <CoinIcon symbol={m.symbol} size={16} />
                          <span>{m.symbol.split('/')[0]}</span>
                        </div>
                        <span className={m.priceChangePercent >= 0 ? 'text-successGreen' : 'text-errorRed'}>
                          {m.priceChangePercent >= 0 ? '+' : ''}{m.priceChangePercent.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-sm font-bold">
                        ${m.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Transactions History */}
              <div className="bg-card border border-darkGray p-5 rounded-xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted flex items-center gap-1.5">
                    <History className="h-4 w-4 text-purple-500" /> Recent Transactions
                  </h4>
                  <Link to="/wallet" className="text-xs text-accentBlue hover:underline">View Wallet</Link>
                </div>
                {transactions.length > 0 ? (
                  <div className="divide-y divide-darkGray">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center py-2.5 text-xs font-semibold">
                        <div className="flex items-center space-x-2.5">
                          <CoinIcon symbol={tx.symbol} size={20} />
                          <div>
                            <span className={tx.type === 'DEPOSIT' ? 'text-successGreen' : 'text-orange-400'}>
                              {tx.type}
                            </span>
                            <span className="text-textMuted font-normal"> • {tx.symbol}</span>
                            <span className="text-textMuted block font-normal text-[10px] mt-0.5">
                              {new Date(tx.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold">
                            {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount.toFixed(4)}
                          </span>
                          <span className="text-textMuted block font-normal text-[10px]">
                            Status: <span className="text-white uppercase">{tx.status}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-textMuted">No recent transactions recorded.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
