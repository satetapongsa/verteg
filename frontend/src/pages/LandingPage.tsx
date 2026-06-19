import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedPair } from '../store';
import { Activity, ArrowRight, Shield, Cpu, Users, TrendingUp, Database, HelpCircle } from 'lucide-react';
import api from '../utils/api';

interface TickerData {
  symbol: string;
  name: string;
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

const coinNames: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  BNB: 'Binance Coin',
  SOL: 'Solana',
  XRP: 'Ripple',
  DOGE: 'Dogecoin',
  ADA: 'Cardano',
  TRX: 'TRON',
  MATIC: 'Polygon'
};

export const LandingPage: React.FC = () => {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await api.get('https://api.binance.com/api/v3/ticker/24hr');
        const targetSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'TRXUSDT', 'MATICUSDT'];
        const filtered = response.data
          .filter((t: any) => targetSymbols.includes(t.symbol))
          .map((t: any) => {
            const coin = t.symbol.replace('USDT', '');
            return {
              symbol: coin,
              name: coinNames[coin] || coin,
              pair: `${coin}_USDT`,
              price: parseFloat(t.lastPrice),
              change24h: parseFloat(t.priceChangePercent),
              high24h: parseFloat(t.highPrice),
              low24h: parseFloat(t.lowPrice),
              volume24h: parseFloat(t.volume)
            };
          });
        // Maintain the order of targets
        const ordered = targetSymbols.map(sym => {
          const coin = sym.replace('USDT', '');
          return filtered.find((f: any) => f.symbol === coin) || {
            symbol: coin,
            name: coinNames[coin] || coin,
            pair: `${coin}_USDT`,
            price: 0,
            change24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0
          };
        }).filter(item => item.price > 0);

        setTickers(ordered);
      } catch (err) {
        // Fallback static values
        const defaultPrices: Record<string, number> = {
          BTC: 65000.00,
          ETH: 3500.00,
          BNB: 600.00,
          SOL: 150.00,
          XRP: 0.50,
          DOGE: 0.12,
          ADA: 0.45,
          TRX: 0.11,
          MATIC: 0.70
        };
        const fallback = Object.keys(defaultPrices).map(coin => ({
          symbol: coin,
          name: coinNames[coin] || coin,
          pair: `${coin}_USDT`,
          price: defaultPrices[coin],
          change24h: coin === 'SOL' || coin === 'XRP' || coin === 'DOGE' || coin === 'MATIC' ? 1.5 : -0.8,
          high24h: defaultPrices[coin] * 1.05,
          low24h: defaultPrices[coin] * 0.95,
          volume24h: 40000 + Math.random() * 300000
        }));
        setTickers(fallback);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTradeClick = (pair: string) => {
    dispatch(setSelectedPair(pair));
    navigate('/trade');
  };

  return (
    <div className="bg-[#0A0E17] min-h-screen text-gray-100 flex flex-col justify-between">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 w-full">
        
        {/* Left Info Column */}
        <div className="flex-1 space-y-8 text-center lg:text-left z-10">
          <div className="inline-flex items-center space-x-2 bg-blue-950/40 border border-blue-900/60 rounded-full px-4.5 py-1.5 text-xs font-bold text-[#38BDF8]">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>MATCHING ENGINE SPEED &lt; 1MS</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.1] font-sans">
            Trade Digital <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Assets
            </span>{' '}
            Instantly
          </h1>
          <p className="text-gray-400 max-w-lg text-[15px] leading-relaxed">
            Vertex provides institutional-grade matching speeds, next-generation security, and deep liquidity pools for the world's top cryptocurrencies.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link 
              to="/register" 
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/25"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a 
              href="#live-markets" 
              className="bg-transparent border border-gray-800 hover:border-gray-700 text-gray-300 font-bold px-7 py-3 rounded-lg flex items-center justify-center transition-all"
            >
              View Live Pricing
            </a>
          </div>
        </div>

        {/* Right Stats Column (4 Premium Cards Grid) */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 z-10">
          <div className="bg-[#111827] border border-gray-800/80 p-6 rounded-xl space-y-4">
            <Users className="text-blue-500 w-7 h-7" />
            <div>
              <div className="text-2xl font-black text-white">2.4M+</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Trading Accounts</div>
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-800/80 p-6 rounded-xl space-y-4">
            <TrendingUp className="text-green-500 w-7 h-7" />
            <div>
              <div className="text-2xl font-black text-white">$3.2B+</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">24h Trade Volume</div>
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-800/80 p-6 rounded-xl space-y-4">
            <Cpu className="text-purple-500 w-7 h-7" />
            <div>
              <div className="text-2xl font-black text-white">1.8M TPS</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Engine Capacity</div>
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-800/80 p-6 rounded-xl space-y-4">
            <Shield className="text-yellow-500 w-7 h-7" />
            <div>
              <div className="text-2xl font-black text-white">100% Secure</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Cold Storage Vaults</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live markets Ticker table section */}
      <section id="live-markets" className="max-w-7xl mx-auto px-8 py-12 w-full">
        <div className="flex items-center space-x-2.5 mb-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <h2 className="text-2xl font-black text-white tracking-wide">Live Cryptocurrency Markets</h2>
        </div>
        <p className="text-gray-400 text-xs mb-8">Track real-time pricing trends of the top digital assets on Vertex.</p>

        <div className="bg-[#111827] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] uppercase text-gray-500 font-bold tracking-wider bg-gray-950/20">
                  <th className="py-4 px-6">Asset</th>
                  <th className="py-4 px-4 text-right">Price (USDT)</th>
                  <th className="py-4 px-4 text-right">24h Performance</th>
                  <th className="py-4 px-4 text-right">24h High</th>
                  <th className="py-4 px-4 text-right">24h Low</th>
                  <th className="py-4 px-4 text-right">24h Volume</th>
                  <th className="py-4 px-6 text-center">Trade Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 font-semibold text-gray-300">
                {tickers.map((ticker) => {
                  const isPositive = ticker.change24h >= 0;
                  return (
                    <tr key={ticker.pair} className="hover:bg-gray-800/20 transition-all">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <img 
                          src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${ticker.symbol.toLowerCase()}.png`} 
                          alt={ticker.symbol}
                          className="w-7 h-7"
                          onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'; }}
                        />
                        <div>
                          <div className="font-extrabold text-white text-sm tracking-wide">{ticker.symbol}</div>
                          <div className="text-[10px] text-gray-500 font-medium">{ticker.name}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-white font-mono text-[13px]">
                        ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-4 px-4 text-right font-mono text-[13px] ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {isPositive ? '+' : ''}{ticker.change24h.toFixed(2)}%
                      </td>
                      <td className="py-4 px-4 text-right text-gray-400 font-mono">
                        ${ticker.high24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-400 font-mono">
                        ${ticker.low24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-400 font-mono">
                        {Math.round(ticker.volume24h).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button 
                          onClick={() => handleTradeClick(ticker.pair)}
                          className="border border-gray-800 hover:border-gray-700 bg-transparent text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          Trade Spot
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Institutional-Grade Infrastructure Section */}
      <section className="max-w-7xl mx-auto px-8 py-16 w-full text-center">
        <h2 className="text-3xl font-black text-white mb-2">Institutional-Grade Infrastructure</h2>
        <p className="text-gray-400 text-xs max-w-xl mx-auto mb-12">
          Vertex is built on military-grade encryption systems, multi-node replication backends, and fully regulated financial custody flows.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#111827] border border-gray-800/80 p-8 rounded-2xl text-left space-y-4">
            <Database className="text-blue-500 w-8 h-8" />
            <h3 className="text-lg font-bold text-white">SQL Real-Time Sync</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Dual-write transaction pipelines commit matching engine results to PostgreSQL with sub-millisecond latencies.
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800/80 p-8 rounded-2xl text-left space-y-4 relative">
            <Shield className="text-purple-500 w-8 h-8" />
            <div className="inline-block bg-[#A855F7]/10 text-[#C084FC] border border-[#A855F7]/20 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              AMSI ACTIVE
            </div>
            <h3 className="text-lg font-bold text-white">2FA/TOTP Lockout</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Integrated Google Authenticator TOTP algorithms block raw script requests and credential leak bypasses.
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800/80 p-8 rounded-2xl text-left space-y-4">
            <Activity className="text-green-500 w-8 h-8" />
            <h3 className="text-lg font-bold text-white">Liquidity Control</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Automated market maker flows feed buy/sell order spreads into internal order queues continuously.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0E17] border-t border-gray-900/60 py-8 px-8 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
        <div>© 2026 Vertex Group. Security Audited & Verified.</div>
        <div className="flex space-x-6">
          <a href="#" className="hover:text-gray-300">User Agreement</a>
          <a href="#" className="hover:text-gray-300">Privacy Statement</a>
          <a href="#" className="hover:text-gray-300">API References</a>
          <a href="#" className="hover:text-gray-300">Help desk</a>
        </div>
      </footer>

    </div>
  );
};
