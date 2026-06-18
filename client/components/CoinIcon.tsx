import React, { useState } from 'react';

interface CoinIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ symbol, size = 24, className = '' }) => {
  const [error, setError] = useState(false);
  const cleanSymbol = symbol.toUpperCase().split('/')[0];

  // Helper colors for local initials fallback
  const fallbackColors: Record<string, string> = {
    BTC: 'bg-yellow-500 text-black',
    ETH: 'bg-indigo-600 text-white',
    USDT: 'bg-green-600 text-white',
    BNB: 'bg-yellow-400 text-black',
    SOL: 'bg-purple-600 text-white',
    XRP: 'bg-blue-500 text-white',
    DOGE: 'bg-yellow-600 text-white',
    ADA: 'bg-blue-700 text-white',
    TRX: 'bg-red-600 text-white',
    MATIC: 'bg-purple-700 text-white',
  };

  const colorClass = fallbackColors[cleanSymbol] || 'bg-gray-700 text-white';
  const iconUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cleanSymbol.toLowerCase()}.png`;

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-full flex items-center justify-center font-bold text-[10px] uppercase select-none shrink-0 ${colorClass} ${className}`}
      >
        {cleanSymbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={`${cleanSymbol} Icon`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      className={`rounded-full select-none shrink-0 object-cover ${className}`}
    />
  );
};
