import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useWebSocket } from '../context/WebSocketContext';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers, History, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Settings2, Wallet } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';

interface Ticker {
  symbol: string;
  lastPrice: number;
  high: number;
  low: number;
  volume: number;
  priceChange: number;
  priceChangePercent: number;
}

interface OrderBookLevel {
  price: number;
  amount: number;
}

interface DBOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP';
  price: number | null;
  amount: number;
  filledAmount: number;
  status: string;
  createdAt: string;
}

interface PublicTrade {
  id: string;
  price: number;
  amount: number;
  createdAt: string;
}

interface ChartDataPoint {
  time: string;
  price: number;
  volume: number;
  ema20: number;
  ema50: number;
}

export const TradingPage: React.FC = () => {
  const { subscribe } = useWebSocket();

  // Active state
  const [activeSymbol, setActiveSymbol] = useState('BTC/USDT');
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [recentTrades, setRecentTrades] = useState<PublicTrade[]>([]);
  const [openOrders, setOpenOrders] = useState<DBOrder[]>([]);
  
  // Wallet Balances
  const [baseBalance, setBaseBalance] = useState(0);
  const [quoteBalance, setQuoteBalance] = useState(0);

  // Form States
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP'>('LIMIT');
  const [price, setPrice] = useState('65000');
  const [amount, setAmount] = useState('0.01');
  const [stopPrice, setStopPrice] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Animation Flash states
  const [lastTradePrice, setLastTradePrice] = useState<number>(0);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN' | 'STABLE'>('STABLE');

  // Chart timeframes & data
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d'>('1h');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // Fetch initial market data and user balances
  const fetchMarketData = async () => {
    try {
      const tickerRes = await api.get(`/market/ticker/${activeSymbol}`);
      setTicker(tickerRes.data);

      const orderbookRes = await api.get(`/market/orderbook/${activeSymbol}`);
      setBids(orderbookRes.data.bids.slice(0, 12));
      setAsks(orderbookRes.data.asks.slice(0, 12));

      const tradesRes = await api.get(`/market/trades/${activeSymbol}`);
      setRecentTrades(tradesRes.data.trades);
    } catch (err) {
      console.error('Error fetching market info', err);
    }
  };

  const fetchUserBalancesAndOrders = async () => {
    try {
      const balanceRes = await api.get('/wallet/balances');
      const wallets = balanceRes.data.wallets;
      const [baseSym, quoteSym] = activeSymbol.split('/');
      
      const baseW = wallets.find((w: any) => w.symbol === baseSym);
      const quoteW = wallets.find((w: any) => w.symbol === quoteSym);
      setBaseBalance(baseW ? baseW.balance : 0);
      setQuoteBalance(quoteW ? quoteW.balance : 0);

      const ordersRes = await api.get('/trade/open-orders');
      setOpenOrders(ordersRes.data.orders.filter((o: DBOrder) => o.symbol === activeSymbol));
    } catch (err) {
      console.error('Error fetching user stats', err);
    }
  };

  // Generate premium mock chart data with Moving Averages & Volume
  const initChartData = (baseVal: number) => {
    const data: ChartDataPoint[] = [];
    const now = Date.now();
    let prevEma20 = baseVal;
    let prevEma50 = baseVal;

    for (let i = 40; i >= 0; i--) {
      const t = new Date(now - i * 30 * 60 * 1000);
      const randomMultiplier = 1 + (Math.random() - 0.5) * 0.015;
      const priceVal = parseFloat((baseVal * randomMultiplier).toFixed(2));
      const volumeVal = Math.floor(Math.random() * 500) + 100;

      // Simple EMA calculations
      const ema20 = parseFloat((priceVal * 0.1 + prevEma20 * 0.9).toFixed(2));
      const ema50 = parseFloat((priceVal * 0.05 + prevEma50 * 0.95).toFixed(2));
      prevEma20 = ema20;
      prevEma50 = ema50;

      data.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: priceVal,
        volume: volumeVal,
        ema20,
        ema50,
      });
    }
    setChartData(data);
  };

  useEffect(() => {
    fetchMarketData();
    fetchUserBalancesAndOrders();
    
    // Set standard inputs based on selected coin
    const defaults: Record<string, string> = {
      'BTC/USDT': '65000',
      'ETH/USDT': '3500',
      'BNB/USDT': '600',
      'SOL/USDT': '150',
      'XRP/USDT': '0.50',
      'DOGE/USDT': '0.12',
      'ADA/USDT': '0.45',
      'TRX/USDT': '0.11',
      'MATIC/USDT': '0.70',
    };
    setPrice(defaults[activeSymbol] || '1.0');
    initChartData(parseFloat(defaults[activeSymbol] || '1.0'));

    // WebSocket Channel Subscriptions
    const unsubTicker = subscribe(`market:${activeSymbol}:ticker`, (data) => {
      setTicker((prev) => {
        if (!prev) return null;
        if (data.price > prev.lastPrice) {
          setPriceDirection('UP');
        } else if (data.price < prev.lastPrice) {
          setPriceDirection('DOWN');
        }
        return { ...prev, lastPrice: data.price };
      });

      setLastTradePrice(data.price);

      // Append price changes to the chart
      setChartData((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0) {
          next[lastIndex].price = data.price;
          // Recalculate EMAs
          next[lastIndex].ema20 = parseFloat((data.price * 0.1 + next[Math.max(0, lastIndex - 1)].ema20 * 0.9).toFixed(2));
          next[lastIndex].ema50 = parseFloat((data.price * 0.05 + next[Math.max(0, lastIndex - 1)].ema50 * 0.95).toFixed(2));
        }
        return next;
      });
    });

    const unsubOrderbook = subscribe(`market:${activeSymbol}:orderbook`, (data) => {
      setBids(data.data.bids.slice(0, 12));
      setAsks(data.data.asks.slice(0, 12));
    });

    const unsubTrades = subscribe(`market:${activeSymbol}:trades`, (data) => {
      setRecentTrades((prev) => [...data.data, ...prev].slice(0, 50));
    });

    const unsubUser = subscribe('user:updates', () => {
      fetchUserBalancesAndOrders();
    });

    return () => {
      unsubTicker();
      unsubOrderbook();
      unsubTrades();
      unsubUser();
    };
  }, [activeSymbol]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);
    setOrderLoading(true);

    try {
      const res = await api.post('/trade/order', {
        symbol: activeSymbol,
        side: orderSide,
        type: orderType,
        price: orderType === 'MARKET' ? undefined : price,
        amount,
        stopPrice: orderType === 'STOP' ? stopPrice : undefined,
      });

      setOrderSuccess(res.data.message);
      fetchUserBalancesAndOrders();
    } catch (err: any) {
      setOrderError(err.response?.data?.message || 'Failed to place order');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await api.delete(`/trade/order/${orderId}`);
      fetchUserBalancesAndOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  // Balance percentage allocation handler
  const handlePercentClick = (percent: number) => {
    const currentPriceFloat = orderType === 'MARKET' && ticker ? ticker.lastPrice : parseFloat(price);
    if (isNaN(currentPriceFloat) || currentPriceFloat <= 0) return;

    if (orderSide === 'BUY') {
      const quoteToSpend = quoteBalance * (percent / 100);
      const calculatedAmount = quoteToSpend / currentPriceFloat;
      setAmount(calculatedAmount.toFixed(4));
    } else {
      const calculatedAmount = baseBalance * (percent / 100);
      setAmount(calculatedAmount.toFixed(4));
    }
  };

  // Helper calculations
  const [baseSym, quoteSym] = activeSymbol.split('/');
  const tickerChange = ticker ? ticker.priceChangePercent : 0;
  const isPositive = tickerChange >= 0;

  // Max volumes for book sizing
  const maxBidVolume = bids.reduce((max, b) => Math.max(max, b.amount), 0.001);
  const maxAskVolume = asks.reduce((max, a) => Math.max(max, a.amount), 0.001);

  return (
    <div className="min-h-screen bg-[#080B11] text-white flex flex-col p-4 space-y-4">
      {/* Modern High-End Ticker Row */}
      <div className="bg-[#111622] border border-[#1F293D] px-6 py-4 rounded-xl flex flex-wrap items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-accentBlue"></div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#171E2E] border border-[#2B354F] px-3 py-1.5 rounded-lg">
            <CoinIcon symbol={activeSymbol} size={32} />
            <select
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value)}
              className="bg-transparent text-white font-extrabold text-xl outline-none cursor-pointer border-none focus:ring-0 focus:outline-none"
            >
              <option className="bg-[#171E2E]" value="BTC/USDT">BTC/USDT</option>
              <option className="bg-[#171E2E]" value="ETH/USDT">ETH/USDT</option>
              <option className="bg-[#171E2E]" value="BNB/USDT">BNB/USDT</option>
              <option className="bg-[#171E2E]" value="SOL/USDT">SOL/USDT</option>
              <option className="bg-[#171E2E]" value="XRP/USDT">XRP/USDT</option>
              <option className="bg-[#171E2E]" value="DOGE/USDT">DOGE/USDT</option>
              <option className="bg-[#171E2E]" value="ADA/USDT">ADA/USDT</option>
              <option className="bg-[#171E2E]" value="TRX/USDT">TRX/USDT</option>
              <option className="bg-[#171E2E]" value="MATIC/USDT">MATIC/USDT</option>
            </select>
          </div>

          {ticker && (
            <div className="flex flex-col">
              <span className={`text-2xl font-black tracking-tight flex items-center gap-1.5 transition-colors ${
                priceDirection === 'UP' ? 'text-successGreen' : priceDirection === 'DOWN' ? 'text-errorRed' : 'text-white'
              }`}>
                ${ticker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {isPositive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              </span>
              <span className={`text-xs font-bold ${isPositive ? 'text-successGreen' : 'text-errorRed'}`}>
                {isPositive ? '+' : ''}{tickerChange.toFixed(2)}% (24h)
              </span>
            </div>
          )}
        </div>

        {ticker && (
          <div className="flex flex-wrap gap-8 text-xs font-semibold">
            <div className="bg-[#171E2E] px-4 py-2 rounded-lg border border-[#1F293D]">
              <span className="text-textMuted block text-[10px] uppercase font-bold mb-0.5">24h High</span>
              <span className="text-white font-bold">${ticker.high.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#171E2E] px-4 py-2 rounded-lg border border-[#1F293D]">
              <span className="text-textMuted block text-[10px] uppercase font-bold mb-0.5">24h Low</span>
              <span className="text-white font-bold">${ticker.low.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#171E2E] px-4 py-2 rounded-lg border border-[#1F293D]">
              <span className="text-textMuted block text-[10px] uppercase font-bold mb-0.5">24h Volume ({baseSym})</span>
              <span className="text-white font-bold">{ticker.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Workspace Grid */}
      <div className="grid lg:grid-cols-4 gap-4 flex-grow items-stretch">
        
        {/* Professional Order Book */}
        <div className="bg-[#111622] border border-[#1F293D] rounded-xl flex flex-col justify-between overflow-hidden shadow-2xl lg:col-span-1 h-[680px]">
          <div className="p-3.5 bg-[#171E2E] border-b border-[#1F293D] flex items-center justify-between text-xs font-bold text-textMuted uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><Layers className="h-4.5 w-4.5 text-accentBlue" /> Order Book</span>
            <span>Spread</span>
          </div>

          {/* Asks (Sell Orders) - Red */}
          <div className="flex-1 overflow-y-auto flex flex-col-reverse justify-end pr-1 text-xs">
            {asks.length > 0 ? (
              asks.slice().reverse().map((ask, idx) => (
                <div key={`ask-${idx}`} className="relative flex justify-between py-1 px-4 font-semibold group hover:bg-[#1E1920] transition-colors cursor-pointer">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-950/20 pointer-events-none transition-all duration-300"
                    style={{ width: `${(ask.amount / maxAskVolume) * 100}%` }}
                  ></div>
                  <span className="text-errorRed relative z-10 font-mono">{ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-[#C5D0E6] relative z-10 font-mono">{ask.amount.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-textMuted text-[10px]">No sell asks</div>
            )}
          </div>

          {/* Spread / Mid Market indicator with animation */}
          <div className="py-2.5 px-4 bg-[#141A29] border-y border-[#1F293D] flex justify-between items-center text-sm">
            <span className={`font-black tracking-tight transition-all duration-300 ${
              priceDirection === 'UP' ? 'text-successGreen scale-105' : priceDirection === 'DOWN' ? 'text-errorRed scale-105' : 'text-white'
            }`}>
              ${ticker?.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-textMuted font-bold uppercase">Mid Market</span>
          </div>

          {/* Bids (Buy Orders) - Green */}
          <div className="flex-1 overflow-y-auto pr-1 text-xs">
            {bids.length > 0 ? (
              bids.map((bid, idx) => (
                <div key={`bid-${idx}`} className="relative flex justify-between py-1 px-4 font-semibold group hover:bg-[#142321] transition-colors cursor-pointer">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-green-950/20 pointer-events-none transition-all duration-300"
                    style={{ width: `${(bid.amount / maxBidVolume) * 100}%` }}
                  ></div>
                  <span className="text-successGreen relative z-10 font-mono">{bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-[#C5D0E6] relative z-10 font-mono">{bid.amount.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-textMuted text-[10px]">No buy bids</div>
            )}
          </div>
        </div>

        {/* Central Charting & Trading Panel */}
        <div className="lg:col-span-2 grid grid-rows-3 gap-4 h-[680px]">
          
          {/* Advanced Composed Chart (Line + Vol + Indicators) */}
          <div className="row-span-2 bg-[#111622] border border-[#1F293D] rounded-xl p-4 flex flex-col justify-between shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-[#E5E9F0] tracking-wider uppercase flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-accentBlue" /> Technical Chart Feed
              </h3>
              <div className="flex bg-[#171E2E] p-0.5 rounded border border-[#1F293D] text-[10px] font-bold">
                {(['1h', '4h', '1d'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTimeframe(tf);
                      initChartData(ticker ? ticker.lastPrice : 65000);
                    }}
                    className={`px-3 py-1 rounded transition-colors ${
                      timeframe === tf ? 'bg-accentBlue text-white' : 'text-textMuted hover:text-white'
                    }`}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-grow w-full h-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="95%">
                  <ComposedChart data={chartData}>
                    <XAxis dataKey="time" stroke="#4B5563" fontSize={9} tickLine={false} />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#4B5563"
                      fontSize={9}
                      tickLine={false}
                      orientation="right"
                      tickFormatter={(v) => `$${v.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111622', borderColor: '#1F293D', color: '#fff' }}
                      formatter={(value: any, name: string) => [
                        name === 'price' ? `$${value.toLocaleString()}` : value,
                        name.toUpperCase(),
                      ]}
                    />
                    
                    {/* Volume Bar Overlay */}
                    <Bar dataKey="volume" fill="#1F293D" opacity={0.3} yAxisId={0} barSize={10} />
                    
                    {/* Price and Moving Averages */}
                    <Line type="monotone" dataKey="price" stroke="#2563EB" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="ema20" stroke="#F59E0B" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="ema50" stroke="#8B5CF6" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-textMuted text-xs">Simulating feeds...</div>
              )}
            </div>

            {/* EMA Indicators Legend */}
            <div className="flex items-center space-x-4 text-[10px] font-bold text-textMuted mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accentBlue"></span> PRICE</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#F59E0B] border-dashed"></span> EMA(20)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#8B5CF6] border-dashed"></span> EMA(50)</span>
            </div>
          </div>

          {/* Premium Professional Trade Form */}
          <div className="row-span-1 bg-[#111622] border border-[#1F293D] p-5 rounded-xl shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Header Buy/Sell selection */}
            <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
              <div className="flex bg-[#171E2E] p-0.5 rounded-lg border border-[#2B354F]">
                <button
                  onClick={() => setOrderSide('BUY')}
                  className={`px-5 py-1.5 text-xs font-extrabold rounded-md transition-all ${
                    orderSide === 'BUY' ? 'bg-successGreen text-white shadow' : 'text-textMuted hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderSide('SELL')}
                  className={`px-5 py-1.5 text-xs font-extrabold rounded-md transition-all ${
                    orderSide === 'SELL' ? 'bg-errorRed text-white shadow' : 'text-textMuted hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Order type selections */}
              <div className="flex space-x-3 text-xs">
                {(['LIMIT', 'MARKET', 'STOP'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`font-bold py-1 transition-all ${
                      orderType === type ? 'text-accentBlue border-b-2 border-accentBlue' : 'text-textMuted hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs Block */}
            <form onSubmit={handlePlaceOrder} className="grid sm:grid-cols-4 gap-4 items-end mt-4">
              {orderType === 'STOP' && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider">Stop Trigger</span>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={stopPrice}
                      onChange={(e) => setStopPrice(e.target.value)}
                      className="w-full bg-[#171E2E] border border-[#2B354F] focus:border-accentBlue py-2 px-3 rounded-lg text-xs outline-none font-bold font-mono"
                    />
                  </div>
                </div>
              )}

              {orderType !== 'MARKET' && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider">Price ({quoteSym})</span>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-[#171E2E] border border-[#2B354F] focus:border-accentBlue py-2 px-3 rounded-lg text-xs outline-none font-bold font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider">Amount ({baseSym})</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#171E2E] border border-[#2B354F] focus:border-accentBlue py-2 px-3 rounded-lg text-xs outline-none font-bold font-mono"
                />
              </div>

              {/* Slider percent helper selectors */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider block">Split Capital</span>
                <div className="grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => handlePercentClick(percent)}
                      className="bg-[#171E2E] hover:bg-[#2B354F] border border-[#1F293D] py-2 text-[10px] font-extrabold rounded-md transition-colors text-white"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit panel */}
              <div className="sm:col-span-2 flex flex-col justify-end">
                <span className="text-[10px] text-textMuted font-bold mb-1 flex items-center gap-1 justify-end">
                  <Wallet className="h-3.5 w-3.5 text-accentBlue" />
                  Bal: {orderSide === 'BUY' ? `${quoteBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quoteSym}` : `${baseBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${baseSym}`}
                </span>
                <button
                  type="submit"
                  disabled={orderLoading}
                  className={`w-full font-bold py-2.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-all text-white shadow-xl ${
                    orderSide === 'BUY' 
                      ? 'bg-successGreen hover:bg-green-600 disabled:bg-green-700 shadow-green-500/10' 
                      : 'bg-errorRed hover:bg-red-600 disabled:bg-red-700 shadow-red-500/10'
                  }`}
                >
                  {orderLoading ? (
                    <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Execute {orderSide} Trade</span>
                  )}
                </button>
              </div>
            </form>

            {/* Error notifications */}
            {(orderError || orderSuccess) && (
              <div className="text-[10px] font-bold mt-2 text-center">
                {orderError && <span className="text-errorRed">{orderError}</span>}
                {orderSuccess && <span className="text-successGreen">{orderSuccess}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Public Trades History */}
        <div className="bg-[#111622] border border-[#1F293D] rounded-xl flex flex-col overflow-hidden shadow-2xl lg:col-span-1 h-[680px]">
          <div className="p-3.5 bg-[#171E2E] border-b border-[#1F293D] text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
            <History className="h-4.5 w-4.5 text-purple-500 animate-pulse" /> Market History
          </div>
          <div className="flex-grow overflow-y-auto pr-1 text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-textMuted text-left border-b border-[#1F293D] bg-gray-900/10">
                  <th className="px-4 py-2.5">Price ({quoteSym})</th>
                  <th className="px-4 py-2.5 text-right">Size ({baseSym})</th>
                  <th className="px-4 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="font-semibold font-mono">
                {recentTrades.map((t, idx) => (
                  <tr key={`t-${idx}`} className="hover:bg-darkGray/10 border-b border-[#111622]/20">
                    <td className="px-4 py-2 text-successGreen">{t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right text-white">{t.amount.toFixed(4)}</td>
                    <td className="px-4 py-2 text-right text-textMuted text-[10px]">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* User Open Orders List Row */}
      <div className="bg-[#111622] border border-[#1F293D] rounded-xl overflow-hidden shadow-2xl mt-4">
        <div className="p-4 border-b border-[#1F293D] bg-[#171E2E] flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#E5E9F0] uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="h-4.5 w-4.5 text-accentBlue" /> Active Orders
          </h3>
          <span className="bg-[#1F293D] text-textMuted px-2 py-0.5 rounded text-[10px] font-bold">{openOrders.length} Pending</span>
        </div>
        {openOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="border-b border-[#1F293D] text-textMuted uppercase bg-[#171E2E]/40">
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Side</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5 text-right">Price ({quoteSym})</th>
                  <th className="px-6 py-3.5 text-right">Amount ({baseSym})</th>
                  <th className="px-6 py-3.5 text-right">Filled</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D] font-mono">
                {openOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-darkGray/10 transition-colors">
                    <td className="px-6 py-3.5 text-textMuted">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className={`px-6 py-3.5 font-bold ${o.side === 'BUY' ? 'text-successGreen' : 'text-errorRed'}`}>
                      {o.side}
                    </td>
                    <td className="px-6 py-3.5 text-textMuted uppercase">{o.type}</td>
                    <td className="px-6 py-3.5 text-right font-bold">{o.price ? o.price.toLocaleString() : 'Market'}</td>
                    <td className="px-6 py-3.5 text-right font-bold">{o.amount.toFixed(4)}</td>
                    <td className="px-6 py-3.5 text-right text-accentBlue font-bold">{o.filledAmount.toFixed(4)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-yellow-950/40 text-yellow-500 border border-yellow-900/40">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        onClick={() => handleCancelOrder(o.id)}
                        className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/40 border border-red-900/60 text-red-400 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-textMuted">No active open orders on this book.</div>
        )}
      </div>
    </div>
  );
};
