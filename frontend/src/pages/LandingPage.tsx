import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Shield, Zap, TrendingUp, Users, ArrowRight, Activity, Cpu, Globe, Database } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';

interface MarketData {
  symbol: string;
  name: string;
  lastPrice: number;
  high: number;
  low: number;
  volume: number;
  priceChangePercent: number;
}

export const LandingPage: React.FC = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await api.get('/market/overview');
        setMarkets(res.data.markets);
      } catch (err) {
        console.error('Error fetching landing page markets', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#080B11] flex flex-col justify-between overflow-x-hidden selection:bg-blue-600/30 selection:text-white">
      {/* Glow and Radial background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-36 overflow-hidden border-b border-[#1F293D]">
        {/* Animated matrix/grid backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center relative z-10">
          <div className="space-y-8 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 bg-blue-950/30 border border-blue-900/40 text-accentBlue px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              <Activity className="h-4.5 w-4.5 animate-pulse text-accentBlue" />
              <span>Matching Engine Speed &lt; 1ms</span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight tracking-tight">
              Trade Digital <span className="bg-gradient-to-r from-accentBlue to-purple-400 bg-clip-text text-transparent">Assets</span> Instantly
            </h1>
            <p className="text-textMuted text-lg max-w-lg mx-auto md:mx-0 font-medium leading-relaxed">
              Vertex provides institutional-grade matching speeds, next-generation security, and deep liquidity pools for the world's top cryptocurrencies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link
                to="/register"
                className="px-8 py-4 bg-accentBlue hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center space-x-2.5 transition-all transform hover:-translate-y-0.5"
              >
                <span>Create Free Account</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#markets"
                className="px-8 py-4 bg-[#111622] hover:bg-[#171E2E] text-white border border-[#2B354F] font-bold rounded-xl flex items-center justify-center transition-all transform hover:-translate-y-0.5"
              >
                View Live Pricing
              </a>
            </div>
          </div>

          {/* Glowing Metrics grid */}
          <div className="grid grid-cols-2 gap-6 relative">
            {/* Background neon boarder shadow */}
            <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl pointer-events-none"></div>
            
            <div className="bg-[#111622] p-6 rounded-2xl border border-[#1F293D] hover:border-blue-500/40 transition-all group shadow-xl">
              <Users className="h-9 w-9 text-accentBlue mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black block tracking-tight">2.4M+</span>
              <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Trading Accounts</span>
            </div>

            <div className="bg-[#111622] p-6 rounded-2xl border border-[#1F293D] hover:border-successGreen/40 transition-all group shadow-xl">
              <TrendingUp className="h-9 w-9 text-successGreen mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black block tracking-tight">$3.2B+</span>
              <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">24h Trade Volume</span>
            </div>

            <div className="bg-[#111622] p-6 rounded-2xl border border-[#1F293D] hover:border-purple-500/40 transition-all group shadow-xl">
              <Cpu className="h-9 w-9 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black block tracking-tight">1.8M TPS</span>
              <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Engine Capacity</span>
            </div>

            <div className="bg-[#111622] p-6 rounded-2xl border border-[#1F293D] hover:border-yellow-500/40 transition-all group shadow-xl">
              <Shield className="h-9 w-9 text-yellow-500 mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-3xl font-black block tracking-tight">100% Secure</span>
              <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Cold Storage Vaults</span>
            </div>
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section id="markets" className="max-w-7xl mx-auto px-6 py-24 w-full flex-grow relative z-10">
        <div className="space-y-3 mb-10 text-center md:text-left">
          <h2 className="text-3xl font-black tracking-tight flex items-center justify-center md:justify-start gap-2">
            <Globe className="h-7 w-7 text-accentBlue" /> Live Cryptocurreny Markets
          </h2>
          <p className="text-textMuted text-sm font-semibold">Track real-time pricing trends of the top digital assets on Vertex.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-accentBlue border-t-transparent rounded-full animate-spin"></div>
            <span className="text-textMuted text-xs font-bold">Connecting WebSocket streams...</span>
          </div>
        ) : (
          <div className="bg-[#111622] border border-[#1F293D] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1F293D] bg-[#171E2E] text-xs font-bold uppercase tracking-widest text-textMuted">
                    <th className="px-6 py-4.5">Asset</th>
                    <th className="px-6 py-4.5 text-right">Price (USDT)</th>
                    <th className="px-6 py-4.5 text-right">24h Performance</th>
                    <th className="px-6 py-4.5 text-right">24h High</th>
                    <th className="px-6 py-4.5 text-right">24h Low</th>
                    <th className="px-6 py-4.5 text-right">24h Volume</th>
                    <th className="px-6 py-4.5 text-center">Trade Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D] text-sm font-semibold font-mono">
                  {markets.map((m) => {
                    const isPositive = m.priceChangePercent >= 0;
                    return (
                      <tr key={m.symbol} className="hover:bg-[#171E2E]/50 transition-colors">
                        <td className="px-6 py-4.5 flex items-center space-x-3">
                          <CoinIcon symbol={m.symbol} size={28} />
                          <div className="flex flex-col">
                            <span className="text-white text-base font-extrabold font-sans leading-none">{m.symbol.split('/')[0]}</span>
                            <span className="text-textMuted text-[10px] font-medium font-sans mt-0.5">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-right text-base font-bold text-white">
                          ${m.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className={`px-6 py-4.5 text-right font-bold ${isPositive ? 'text-successGreen' : 'text-errorRed'}`}>
                          {isPositive ? '+' : ''}{m.priceChangePercent.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4.5 text-right text-textMuted">
                          ${m.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4.5 text-right text-textMuted">
                          ${m.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4.5 text-right text-textMuted">
                          {m.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <Link
                            to="/trading"
                            className="px-5 py-2 bg-[#171E2E] hover:bg-accentBlue text-white text-xs font-bold rounded-xl border border-[#2B354F] hover:border-transparent transition-all"
                          >
                            Trade Spot
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Feature Info Section */}
      <section className="border-t border-[#1F293D] bg-[#0C101A] py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h3 className="text-3xl font-black tracking-tight">Institutional-Grade Infrastructure</h3>
            <p className="text-textMuted text-sm max-w-xl mx-auto">Vertex is built on military-grade encryption systems, multi-node replication backends, and fully regulated financial custody flows.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#111622] p-8 rounded-2xl border border-[#1F293D] space-y-4">
              <Database className="h-8 w-8 text-accentBlue" />
              <h4 className="text-lg font-bold">SQL Real-Time Sync</h4>
              <p className="text-xs text-textMuted leading-relaxed">Dual-write transaction pipelines commit matching engine results to PostgreSQL with sub-millisecond latencies.</p>
            </div>
            <div className="bg-[#111622] p-8 rounded-2xl border border-[#1F293D] space-y-4">
              <Shield className="h-8 w-8 text-purple-500" />
              <span className="bg-purple-950/40 border border-purple-900/60 text-purple-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase w-max block">AMSI Active</span>
              <h4 className="text-lg font-bold">2FA/TOTP Lockout</h4>
              <p className="text-xs text-textMuted leading-relaxed">Integrated Google Authenticator TOTP algorithms block raw script requests and credential leak bypasses.</p>
            </div>
            <div className="bg-[#111622] p-8 rounded-2xl border border-[#1F293D] space-y-4">
              <Activity className="h-8 w-8 text-successGreen" />
              <h4 className="text-lg font-bold">Liquidity Control</h4>
              <p className="text-xs text-textMuted leading-relaxed">Automated market maker flows feed buy/sell order spreads into internal order queues continuously.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080B11] border-t border-[#1F293D] py-10 px-6 text-xs text-textMuted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <span>&copy; {new Date().getFullYear()} Vertex Group. Security Audited & Verified.</span>
          <div className="flex space-x-6 font-semibold">
            <a href="#" className="hover:text-white transition-colors">User Agreement</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Statement</a>
            <a href="#" className="hover:text-white transition-colors">API References</a>
            <a href="#" className="hover:text-white transition-colors">Help desk</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
