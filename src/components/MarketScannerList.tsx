import React, { useState } from 'react';
import { BinancePairInfo } from '../services/binanceApi';
import { CcxtPairInfo } from '../services/binanceCcxtService';
import {
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface MarketScannerListProps {
  pairs?: (CcxtPairInfo | BinancePairInfo)[];
  onSelectSymbol: (symbol: string) => void;
  onScanPair: (symbol: string) => void;
  selectedSymbol: string;
}

const formatScannerPrice = (price: number, precision?: number): string => {
  if (typeof price !== 'number' || isNaN(price)) return '$0.00';
  try {
    let maxDigits = 4;
    if (typeof precision === 'number' && !isNaN(precision) && precision >= 0) {
      maxDigits = Math.min(8, Math.floor(precision));
    } else if (price < 0.0001) {
      maxDigits = 8;
    } else if (price < 0.01) {
      maxDigits = 6;
    } else if (price < 1) {
      maxDigits = 4;
    } else {
      maxDigits = 2;
    }
    const minDigits = Math.min(2, maxDigits);
    return '$' + price.toLocaleString(undefined, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: Math.max(minDigits, maxDigits),
    });
  } catch {
    return '$' + price.toFixed(2);
  }
};

export const MarketScannerList: React.FC<MarketScannerListProps> = ({
  pairs = [],
  onSelectSymbol,
  onScanPair,
  selectedSymbol,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'GAINERS' | 'LOSERS'>('ALL');

  const safePairs = Array.isArray(pairs) ? pairs : [];

  const filteredPairs = safePairs.filter((p) => {
    if (!p || !p.symbol) return false;
    const matchesSearch = p.symbol.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    const change = p.priceChangePercent ?? 0;
    if (filter === 'GAINERS') return change > 0;
    if (filter === 'LOSERS') return change < 0;
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Top Filter and Search */}
      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search USD-M Pair (e.g. BTC, ETH, SOL)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {(['ALL', 'GAINERS', 'LOSERS'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                filter === f
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3">Pair</th>
              <th className="py-2.5 px-3">Last Price</th>
              <th className="py-2.5 px-3">24h Change</th>
              <th className="py-2.5 px-3">24h Quote Vol</th>
              <th className="py-2.5 px-3 text-right">Analyze</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredPairs.slice(0, 30).map((p) => {
              if (!p) return null;
              const priceChange = p.priceChangePercent ?? 0;
              const isGain = priceChange >= 0;
              const isSelected = p.symbol === selectedSymbol;
              const lastPrice = p.lastPrice ?? 0;
              const volume = p.volume24h ?? 0;

              return (
                <tr
                  key={p.symbol}
                  className={`hover:bg-slate-800/40 transition cursor-pointer ${
                    isSelected ? 'bg-amber-500/10' : ''
                  }`}
                  onClick={() => onSelectSymbol(p.symbol)}
                >
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-white hover:text-amber-400">
                      {p.symbol}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-slate-200">
                    {formatScannerPrice(lastPrice, 'pricePrecision' in p ? p.pricePrecision : undefined)}
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isGain ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isGain ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {isGain ? '+' : ''}
                      {priceChange.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-slate-400">
                    ${(volume / 1000000).toFixed(1)}M
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onScanPair(p.symbol);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 text-[10px] font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>SMC Scan</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
