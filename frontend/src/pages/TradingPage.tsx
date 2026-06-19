import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../utils/api';
import { ArrowDown, ArrowUp, RefreshCw, XCircle } from 'lucide-react';

interface BookItem {
  price: number;
  quantity: number;
}

interface OrderBookState {
  bids: BookItem[];
  asks: BookItem[];
}

interface Order {
  id: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  price: string | null;
  quantity: string;
  filledQty: string;
  status: string;
  createdAt: string;
}

interface Trade {
  id: string;
  price: string;
  quantity: string;
  side: 'BUY' | 'SELL';
  createdAt: string;
}

export const TradingPage: React.FC = () => {
  const selectedPair = useSelector((state: RootState) => state.ui.selectedPair);
  const { subscribeToPair, unsubscribeFromPair, registerListener } = useWebSocket();

  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orderBook, setOrderBook] = useState<OrderBookState>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [ticker, setTicker] = useState({ price: 65420, change24h: 3.42, high24h: 66000, low24h: 64000, volume24h: 1240 });
  const [chartData, setChartData] = useState<number[]>([65000, 65100, 64900, 65200, 65150, 65300, 65420]);

  // Order Entry Form
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('65420');
  const [quantity, setQuantity] = useState('0.1');

  const [walletBalance, setWalletBalance] = useState({ base: 0, quote: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [baseCoin, quoteCoin] = selectedPair.split('_');

  const fetchInitialData = async () => {
    try {
      // Fetch initial book
      const bookRes = await api.get(`/trade/orderbook/${selectedPair}`);
      setOrderBook(bookRes.data);

      // Fetch initial recent trades
      const tradesRes = await api.get(`/trade/recent-trades/${selectedPair}`);
      setRecentTrades(tradesRes.data);

      // Fetch user open orders
      const openRes = await api.get('/trade/open');
      setOpenOrders(openRes.data);

      // Fetch user wallet balances for active pair
      const balRes = await api.get('/wallet/balances');
      const baseBal = balRes.data.find((b: any) => b.coinSymbol === baseCoin);
      const quoteBal = balRes.data.find((b: any) => b.coinSymbol === quoteCoin);
      setWalletBalance({
        base: baseBal ? parseFloat(baseBal.balance) : 0,
        quote: quoteBal ? parseFloat(quoteBal.balance) : 0
      });
    } catch (err) {
      console.error('Failed to load initial pair details', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    subscribeToPair(selectedPair);

    // Register WebSocket Listeners for real-time orderbook, trades, and tickers
    const unbindBook = registerListener('orderbook_update', (data: any) => {
      setOrderBook(data);
    });

    const unbindTrades = registerListener('recent_trades', (data: any) => {
      setRecentTrades(prev => [data[0], ...prev].slice(0, 50));
      // Update chart history
      setChartData(prev => [...prev.slice(1), Number(data[0].price)]);
      // Update live ticker price
      setTicker(prev => ({
        ...prev,
        price: Number(data[0].price)
      }));
    });

    const unbindTicker = registerListener('ticker_update', (data: any) => {
      if (data.pair === selectedPair) {
        setTicker({
          price: data.price,
          change24h: data.change24h,
          high24h: data.high24h,
          low24h: data.low24h,
          volume24h: data.volume24h
        });
      }
    });

    const unbindOrderUpdate = registerListener('order_update', () => {
      // Re-fetch open orders and balances on trade execution
      fetchInitialData();
    });

    return () => {
      unsubscribeFromPair(selectedPair);
      unbindBook();
      unbindTrades();
      unbindTicker();
      unbindOrderUpdate();
    };
  }, [selectedPair]);

  useEffect(() => {
    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    const initWidget = () => {
      if ((window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${baseCoin}${quoteCoin}`,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: 'tradingview_chart'
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      // Small timeout to ensure container is mounted
      setTimeout(initWidget, 100);
    }
  }, [selectedPair, isFullscreen]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/trade/order', {
        pair: selectedPair,
        side,
        type: orderType,
        price: orderType === 'LIMIT' ? parseFloat(price) : undefined,
        quantity: parseFloat(quantity)
      });
      setSuccess('Order submitted successfully');
      fetchInitialData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order placement failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await api.delete(`/trade/order/${orderId}`);
      setSuccess('Order cancelled successfully');
      fetchInitialData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  // SVG Chart Calculation
  const getMinMax = () => {
    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    return { min: min * 0.999, max: max * 1.001 };
  };
  const { min: yMin, max: yMax } = getMinMax();

  return (
    <div className="bg-[#0A0E17] min-h-[92vh] text-gray-100 p-4 space-y-4 max-w-8xl mx-auto flex flex-col">
      {/* Ticker bar */}
      <div className="bg-[#111827] border border-gray-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-bold text-white tracking-wide">{selectedPair.replace('_', '/')}</span>
          <span className={`text-sm font-bold flex items-center space-x-1 ${ticker.change24h >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {ticker.change24h >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
          </span>
        </div>

        <div className="flex space-x-6 text-xs text-gray-400">
          <div>
            <div className="text-[10px] text-gray-500">24h Change</div>
            <div className={`font-bold ${ticker.change24h >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">24h High</div>
            <div className="font-bold text-white">${ticker.high24h.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">24h Low</div>
            <div className="font-bold text-white">${ticker.low24h.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">24h Volume ({baseCoin})</div>
            <div className="font-bold text-white">{ticker.volume24h.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Main Terminal Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
        
        {/* Left Section: Chart & Open Orders (Col 1-3) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          {/* Real-time TradingView Chart Container */}
          <div className={isFullscreen 
            ? "fixed inset-0 z-[999] bg-[#0A0E17] p-6 flex flex-col w-full h-full" 
            : "bg-[#111827] border border-gray-800 p-5 rounded-lg flex-1 min-h-[450px] flex flex-col justify-between"
          }>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 tracking-wider">REAL-TIME TRADINGVIEW CHART</span>
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded text-xs font-semibold transition-all"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
            <div id="tradingview_chart" className="flex-1 w-full mt-4 rounded overflow-hidden min-h-[350px]"></div>
          </div>

          {/* Open Orders Panel */}
          <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg">
            <span className="text-xs font-semibold text-gray-400 tracking-wider">OPEN ACTIVE ORDERS</span>
            
            <div className="overflow-y-auto max-h-48 mt-4">
              <table className="w-full text-left text-xs text-gray-400">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase text-gray-500">
                    <th className="py-1">Side</th>
                    <th className="py-1">Price</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Filled</th>
                    <th className="py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 font-mono">
                  {openOrders.length > 0 ? (
                    openOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-800/10">
                        <td className={`py-2 font-bold ${order.side === 'BUY' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{order.side}</td>
                        <td className="py-2">${order.price ? parseFloat(order.price).toFixed(2) : 'Market'}</td>
                        <td className="py-2 text-right">{parseFloat(order.quantity).toFixed(4)}</td>
                        <td className="py-2 text-right">{parseFloat(order.filledQty).toFixed(4)}</td>
                        <td className="py-2 text-right">
                          <button onClick={() => handleCancelOrder(order.id)} className="text-red-400 hover:text-red-300">
                            <XCircle className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-xs text-gray-500 font-sans">No open trades in queue</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Section: Buy/Sell and Order Book (Col 4) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          
          {/* Order Submission Form (Top Half, scrollable) */}
          <div className="bg-[#111827] border border-gray-800 p-5 rounded-lg space-y-4 max-h-[480px] overflow-y-auto">
            <div className="flex border-b border-gray-800 pb-2">
              <button
                onClick={() => setSide('BUY')}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded ${side === 'BUY' ? 'bg-[#22C55E] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                BUY
              </button>
              <button
                onClick={() => setSide('SELL')}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded ${side === 'SELL' ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                SELL
              </button>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setOrderType('LIMIT')}
                className={`flex-1 text-center py-1 text-[11px] font-semibold border ${orderType === 'LIMIT' ? 'border-[#2563EB] text-[#2563EB]' : 'border-gray-800 text-gray-400'}`}
              >
                Limit
              </button>
              <button
                onClick={() => setOrderType('MARKET')}
                className={`flex-1 text-center py-1 text-[11px] font-semibold border ${orderType === 'MARKET' ? 'border-[#2563EB] text-[#2563EB]' : 'border-gray-800 text-gray-400'}`}
              >
                Market
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              {orderType === 'LIMIT' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400">Price (USDT)</label>
                  <input
                    type="number"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-[#1F2937] border border-gray-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400">Quantity ({baseCoin})</label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-[#1F2937] border border-gray-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none"
                />
              </div>

              <div className="text-xs space-y-1 bg-gray-950 p-3 rounded font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Available Balance:</span>
                  <span className="text-white">
                    {side === 'BUY' 
                      ? `${walletBalance.quote.toFixed(2)} ${quoteCoin}` 
                      : `${walletBalance.base.toFixed(6)} ${baseCoin}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Total:</span>
                  <span className="text-white font-bold">
                    {orderType === 'LIMIT'
                      ? `${(parseFloat(price || '0') * parseFloat(quantity || '0')).toFixed(2)} ${quoteCoin}`
                      : `Market Price`}
                  </span>
                </div>
              </div>

              {error && <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444] p-2 rounded text-center">{error}</div>}
              {success && <div className="text-xs text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E] p-2 rounded text-center">{success}</div>}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 rounded text-xs font-bold text-white transition-all ${side === 'BUY' ? 'bg-[#22C55E] hover:bg-green-700' : 'bg-[#EF4444] hover:bg-red-700'}`}
              >
                {loading ? 'Submitting Order...' : `${side} ${baseCoin}`}
              </button>
            </form>
          </div>

          {/* Short Order Book (Bottom Half, low/compact) */}
          <div className="bg-[#111827] border border-gray-800 p-4 rounded-lg flex flex-col justify-between min-h-[300px] max-h-[350px] overflow-y-auto">
            <div>
              <span className="text-xs font-semibold text-gray-400 tracking-wider">ORDER BOOK</span>
              
              {/* ASKS (SELLS) - Displayed on top, sorted ASC */}
              <div className="space-y-1 mt-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase flex justify-between">
                  <span>Price (USDT)</span>
                  <span>Size ({baseCoin})</span>
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {orderBook.asks.slice().reverse().map((ask, idx) => (
                    <div key={idx} className="flex justify-between text-xs font-mono text-[#EF4444] hover:bg-red-950/20 px-1 rounded">
                      <span>${ask.price.toFixed(2)}</span>
                      <span className="text-gray-300">{ask.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spread/Mid price */}
              <div className="py-1 my-1 border-y border-gray-800 text-center font-bold text-white text-xs font-mono">
                ${ticker.price.toFixed(2)}
              </div>

              {/* BIDS (BUYS) - Displayed below spread, sorted DESC */}
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {orderBook.bids.map((bid, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-mono text-[#22C55E] hover:bg-green-950/20 px-1 rounded">
                    <span>${bid.price.toFixed(2)}</span>
                    <span className="text-gray-300">{bid.quantity.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-gray-500 flex justify-between pt-2 mt-2 border-t border-gray-800">
              <span>WebSocket Stream</span>
              <span className="text-[#22C55E] font-bold">● Active</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
