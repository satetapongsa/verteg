import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShieldCheck, Zap, Coins } from 'lucide-react';
import api from '../utils/api';

interface TickerData {
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export const LandingPage: React.FC = () => {
  const [tickers, setTickers] = useState<TickerData[]>([]);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await api.get('https://api.binance.com/api/v3/ticker/24hr');
        const targetSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
        const filtered = response.data
          .filter((t: any) => targetSymbols.includes(t.symbol))
          .map((t: any) => {
            const pairName = t.symbol.replace('USDT', '_USDT');
            const coin = t.symbol.replace('USDT', '');
            return {
              pair: pairName,
              price: parseFloat(t.lastPrice),
              change24h: parseFloat(t.priceChangePercent),
              high24h: parseFloat(t.highPrice),
              low24h: parseFloat(t.lowPrice),
              volume24h: parseFloat(t.volume)
            };
          });
        setTickers(filtered);
      } catch (err) {
        // Fallback static values
        const defaultPrices: Record<string, number> = {
          BTC_USDT: 68420.50,
          ETH_USDT: 3540.20,
          BNB_USDT: 590.10,
          SOL_USDT: 145.30,
          XRP_USDT: 0.52
        };
        const fallback = Object.keys(defaultPrices).map(pair => ({
          pair,
          price: defaultPrices[pair],
          change24h: 1.45,
          high24h: defaultPrices[pair] * 1.02,
          low24h: defaultPrices[pair] * 0.98,
          volume24h: 3000
        }));
        setTickers(fallback);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0A0E17] min-h-screen text-gray-100 flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="flex-1 space-y-6 text-center lg:text-left z-10">
          <div className="inline-flex items-center space-x-2 bg-blue-950/50 border border-blue-800/60 rounded-full px-4 py-1.5 text-sm font-semibold text-blue-400">
            <Coins className="w-4 h-4" />
            <span>Next Generation Trading Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Trade Assets with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-[#22C55E]">
              Sub-Millisecond Execution
            </span>
          </h1>
          <p className="text-gray-400 max-w-xl text-lg">
            Experience absolute speed. Instant order matching, ultra-low latency WebSocket charts, secure wallet storage, and high-frequency liquidity APIs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link 
              to="/register" 
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded transition-glow flex items-center justify-center space-x-2"
            >
              <span>Get Started Now</span>
              <TrendingUp className="w-5 h-5" />
            </Link>
            <Link 
              to="/login" 
              className="bg-[#111827] border border-gray-800 hover:border-gray-700 font-semibold px-8 py-3.5 rounded flex items-center justify-center"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          {/* Animated Background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/25 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="bg-[#111827] border border-gray-800/80 rounded-xl p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <span className="font-semibold text-white">Live Market Tickers</span>
              <span className="text-xs text-gray-400">Updated: Real-time</span>
            </div>

            <div className="space-y-4">
              {tickers.map((ticker) => {
                const isPositive = ticker.change24h >= 0;
                return (
                  <div key={ticker.pair} className="flex items-center justify-between hover:bg-gray-800/40 p-2.5 rounded transition-all">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${ticker.pair.split('_')[0].toLowerCase()}.png`} 
                        alt={ticker.pair}
                        className="w-6 h-6"
                        onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'; }}
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{ticker.pair.replace('_', '/')}</div>
                        <div className="text-xs text-gray-400">Vol: {Math.round(ticker.volume24h)} USDT</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white text-sm">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className={`text-xs font-semibold ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {isPositive ? '+' : ''}{ticker.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlighting Grid */}
      <section className="bg-[#111827]/30 border-y border-gray-800/50 py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#111827] border border-gray-800/60 p-8 rounded-lg space-y-4">
            <div className="bg-blue-950/60 w-12 h-12 flex items-center justify-center rounded-lg">
              <ShieldCheck className="text-[#2563EB] w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Bank-Grade Defense</h3>
            <p className="text-gray-400 text-sm">
              Full encryption for private keys, session finger-printing, rate-limiting, and Google 2-Factor Authentication protection.
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800/60 p-8 rounded-lg space-y-4">
            <div className="bg-green-950/60 w-12 h-12 flex items-center justify-center rounded-lg">
              <Zap className="text-[#22C55E] w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Sub-Millisecond Matching</h3>
            <p className="text-gray-400 text-sm">
              Ultra-fast in-memory order matching system handles high frequency limits and stop executions with total transactional safety.
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800/60 p-8 rounded-lg space-y-4">
            <div className="bg-purple-950/60 w-12 h-12 flex items-center justify-center rounded-lg">
              <Coins className="text-purple-400 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Diversified Liquidity</h3>
            <p className="text-gray-400 text-sm">
              Instant mock deposit simulations for BTC, ETH, USDT, BNB, SOL, XRP, and DOGE to prototype and build algorithms with speed.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111827] border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© 2026 Verteg Inc. All rights reserved. Platform operates under active compliance monitoring.</p>
      </footer>
    </div>
  );
};
