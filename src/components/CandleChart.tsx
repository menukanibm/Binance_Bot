import React, { useState, useRef, useEffect } from 'react';
import { Candle, SMCAnalysisResult } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Crosshair,
  Maximize2,
  Sparkles,
  Activity,
} from 'lucide-react';

interface CandleChartProps {
  candles?: Candle[];
  analysis?: SMCAnalysisResult | null;
  symbol: string;
  interval: string;
  onSymbolChange: (sym: string) => void;
  onIntervalChange: (tf: string) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles = [],
  analysis,
  symbol,
  interval,
  onSymbolChange,
  onIntervalChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: 420,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const safeCandles = Array.isArray(candles) ? candles : [];

  if (safeCandles.length === 0) {
    return (
      <div className="w-full h-[420px] bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 font-mono text-xs">
        Loading Binance USD-M OHLCV Candles...
      </div>
    );
  }

  const displayCandles = safeCandles.slice(-55);
  const paddingRight = 65;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingLeft = 10;

  const chartWidth = Math.max(100, dimensions.width - paddingRight - paddingLeft);
  const chartHeight = Math.max(100, dimensions.height - paddingTop - paddingBottom);

  const lows = displayCandles.map((c) => c?.low ?? 0).filter((v) => v > 0);
  const highs = displayCandles.map((c) => c?.high ?? 0).filter((v) => v > 0);

  const minPrice = (lows.length > 0 ? Math.min(...lows) : 1) * 0.998;
  const maxPrice = (highs.length > 0 ? Math.max(...highs) : 2) * 1.002;
  const priceRange = maxPrice - minPrice || 1;

  const candleSpacing = chartWidth / (displayCandles.length || 1);
  const candleBodyWidth = Math.max(2, candleSpacing * 0.7);

  const getY = (price: number) => {
    const safeP = isNaN(price) ? minPrice : price;
    return paddingTop + chartHeight - ((safeP - minPrice) / priceRange) * chartHeight;
  };

  const getPriceAtY = (y: number) => {
    const ratio = (paddingTop + chartHeight - y) / chartHeight;
    return minPrice + ratio * priceRange;
  };

  const currentPrice = displayCandles[displayCandles.length - 1]?.close || 0;
  const firstPrice = displayCandles[0]?.open || currentPrice;
  const priceDiff = currentPrice - firstPrice;
  const priceDiffPercent = firstPrice > 0 ? ((priceDiff / firstPrice) * 100).toFixed(2) : '0.00';
  const isUp = priceDiff >= 0;

  const activeOBs = analysis?.orderBlocks || [];
  const activeFVGs = analysis?.fvgZones || [];
  const sweeps = analysis?.liquiditySweeps || [];
  const ew = analysis?.elliottWave;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX >= paddingLeft && mouseX <= dimensions.width - paddingRight) {
      const idx = Math.floor((mouseX - paddingLeft) / candleSpacing);
      if (idx >= 0 && idx < displayCandles.length) {
        setHoveredCandle(displayCandles[idx]);
        setHoverX(paddingLeft + idx * candleSpacing + candleSpacing / 2);
        setHoverY(mouseY);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setHoverX(null);
    setHoverY(null);
  };

  const topSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'SUIUSDT'];
  const timeframes = ['1m', '5m', '15m', '1h'];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Chart Header Bar */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
        <div className="flex items-center gap-3">
          {/* Symbol Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {topSymbols.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => onSymbolChange(s)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                  symbol === s
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {s.replace('USDT', '')}
              </button>
            ))}
            <select
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="bg-slate-900 text-slate-300 text-xs font-semibold border-0 px-2 py-1 rounded focus:outline-none cursor-pointer"
            >
              {topSymbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onIntervalChange(tf)}
                className={`px-2 py-0.5 text-xs font-medium rounded transition cursor-pointer ${
                  interval === tf
                    ? 'bg-slate-700 text-amber-400 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Live Price & SMC / Elliott Wave Confluence Info */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold font-mono text-white">
              ${(currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
            <div
              className={`text-xs font-mono flex items-center justify-end gap-1 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {isUp ? '+' : ''}
                {priceDiffPercent}%
              </span>
            </div>
          </div>

          {/* SMC & Elliott Wave Badges */}
          {analysis && (
            <div className="flex items-center gap-2">
              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                  analysis.bias === 'LONG'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : analysis.bias === 'SHORT'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  SMC: {analysis.bias} ({analysis.confluenceScore}%)
                </span>
              </div>

              {ew && (
                <div className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-cyan-950/40 border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 hidden sm:flex">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Elliott: {ew.currentWave} ({(ew.fibRetracement * 100).toFixed(0)}% Fib)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="relative w-full h-[420px] bg-slate-950 select-none">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair"
        >
          {/* Background Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((pct, idx) => {
            const y = paddingTop + chartHeight * pct;
            const price = getPriceAtY(y);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={dimensions.width - paddingRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={dimensions.width - paddingRight + 6}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {(price || 0).toFixed(symbol.includes('BTC') ? 1 : 2)}
                </text>
              </g>
            );
          })}

          {/* 1. Fair Value Gaps (FVG) Shaded Zones */}
          {activeFVGs.map((fvg, i) => {
            if (!fvg) return null;
            const topY = getY(fvg.top || currentPrice);
            const bottomY = getY(fvg.bottom || currentPrice);
            const boxY = Math.min(topY, bottomY);
            const boxHeight = Math.max(3, Math.abs(bottomY - topY));
            const isBullish = fvg.type === 'BULLISH';

            return (
              <g key={`fvg_${i}`}>
                <rect
                  x={paddingLeft}
                  y={boxY}
                  width={chartWidth}
                  height={boxHeight}
                  fill={isBullish ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)'}
                  stroke={isBullish ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft + 10}
                  y={boxY + boxHeight / 2 + 3}
                  fill={isBullish ? '#34d399' : '#fb7185'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity="0.85"
                >
                  FVG {fvg.type} [{(fvg.bottom || 0).toFixed(2)} - {(fvg.top || 0).toFixed(2)}]
                </text>
              </g>
            );
          })}

          {/* 2. Order Blocks (OB) Shaded Zones */}
          {activeOBs.map((ob, i) => {
            if (!ob) return null;
            const topY = getY(ob.high || currentPrice);
            const bottomY = getY(ob.low || currentPrice);
            const boxY = Math.min(topY, bottomY);
            const boxHeight = Math.max(4, Math.abs(bottomY - topY));
            const isBullish = ob.type === 'BULLISH';

            return (
              <g key={`ob_${i}`}>
                <rect
                  x={paddingLeft}
                  y={boxY}
                  width={chartWidth}
                  height={boxHeight}
                  fill={isBullish ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)'}
                  stroke={isBullish ? '#10b981' : '#ef4444'}
                  strokeWidth="1.2"
                />
                <text
                  x={paddingLeft + 15}
                  y={boxY + 12}
                  fill={isBullish ? '#10b981' : '#ef4444'}
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {isBullish ? '🟩 Bullish Order Block' : '🟥 Bearish Order Block'} ({(ob.low || 0).toFixed(2)} - {(ob.high || 0).toFixed(2)})
                </text>
              </g>
            );
          })}

          {/* 3. Candlesticks */}
          {displayCandles.map((c, i) => {
            if (!c) return null;
            const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
            const openY = getY(c.open || 0);
            const closeY = getY(c.close || 0);
            const highY = getY(c.high || 0);
            const lowY = getY(c.low || 0);

            const isGreen = (c.close || 0) >= (c.open || 0);
            const candleColor = isGreen ? '#10b981' : '#ef4444';
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            return (
              <g key={`candle_${i}`}>
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                <rect
                  x={x - candleBodyWidth / 2}
                  y={bodyY}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  rx="1"
                />
              </g>
            );
          })}

          {/* 4. Liquidity Sweeps Markers */}
          {sweeps.map((sweep, i) => {
            if (!sweep) return null;
            const y = getY(sweep.level || currentPrice);
            const isHighSweep = sweep.type === 'HIGH_SWEEP';
            return (
              <g key={`swp_${i}`}>
                <line
                  x1={chartWidth * 0.4}
                  y1={y}
                  x2={chartWidth + paddingLeft}
                  y2={y}
                  stroke={isHighSweep ? '#fbbf24' : '#38bdf8'}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={chartWidth * 0.45}
                  y={y - 4}
                  fill={isHighSweep ? '#fbbf24' : '#38bdf8'}
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ⚡ {isHighSweep ? 'BUY-SIDE SWEEP' : 'SELL-SIDE SWEEP'} ({(sweep.level || 0).toFixed(2)})
                </text>
              </g>
            );
          })}

          {/* 5. Dynamic Stop Loss (1%) & Take Profit (2%) Target Lines */}
          {analysis && analysis.bias !== 'NEUTRAL' && (
            <>
              {/* Take Profit Target Line (+2%) */}
              <g>
                <line
                  x1={paddingLeft}
                  y1={getY(analysis.bias === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98)}
                  x2={dimensions.width - paddingRight}
                  y2={getY(analysis.bias === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98)}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={dimensions.width - paddingRight - 80}
                  y={getY(analysis.bias === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98) - 9}
                  width="75"
                  height="18"
                  fill="#064e3b"
                  rx="3"
                />
                <text
                  x={dimensions.width - paddingRight - 75}
                  y={getY(analysis.bias === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98) + 3}
                  fill="#34d399"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  TP Target (+2%)
                </text>
              </g>

              {/* Stop Loss Invalidation Line (-1%) */}
              <g>
                <line
                  x1={paddingLeft}
                  y1={getY(analysis.bias === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01)}
                  x2={dimensions.width - paddingRight}
                  y2={getY(analysis.bias === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01)}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={dimensions.width - paddingRight - 80}
                  y={getY(analysis.bias === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01) - 9}
                  width="75"
                  height="18"
                  fill="#881337"
                  rx="3"
                />
                <text
                  x={dimensions.width - paddingRight - 75}
                  y={getY(analysis.bias === 'LONG' ? currentPrice * 0.99 : currentPrice * 1.01) + 3}
                  fill="#fb7185"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  SL Inval (-1%)
                </text>
              </g>
            </>
          )}

          {/* Current Live Price Line */}
          <line
            x1={paddingLeft}
            y1={getY(currentPrice)}
            x2={dimensions.width - paddingRight}
            y2={getY(currentPrice)}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          {/* Current Price Tag on Axis */}
          <rect
            x={dimensions.width - paddingRight + 2}
            y={getY(currentPrice) - 9}
            width={paddingRight - 4}
            height="18"
            fill="#f59e0b"
            rx="3"
          />
          <text
            x={dimensions.width - paddingRight + 6}
            y={getY(currentPrice) + 4}
            fill="#020617"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {(currentPrice || 0).toFixed(symbol.includes('BTC') ? 1 : 2)}
          </text>

          {/* Crosshair Cursor & Hover Information */}
          {hoverX !== null && hoverY !== null && (
            <g>
              <line
                x1={hoverX}
                y1={paddingTop}
                x2={hoverX}
                y2={dimensions.height - paddingBottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingLeft}
                y1={hoverY}
                x2={dimensions.width - paddingRight}
                y2={hoverY}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {/* Hovered Candle Tooltip HUD */}
        {hoveredCandle && (
          <div className="absolute top-2 left-3 bg-slate-900/90 border border-slate-700/80 rounded px-2.5 py-1 text-[11px] font-mono text-slate-300 flex items-center gap-3 backdrop-blur pointer-events-none shadow-lg">
            <span>
              O: <strong className="text-white">{hoveredCandle.open ?? 0}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{hoveredCandle.high ?? 0}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{hoveredCandle.low ?? 0}</strong>
            </span>
            <span>
              C: <strong className="text-white">{hoveredCandle.close ?? 0}</strong>
            </span>
            <span>
              Vol: <strong className="text-amber-400">{Math.round(hoveredCandle.volume ?? 0)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* SMC & Elliott Wave Breakdown Footer */}
      {analysis && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex flex-wrap items-center gap-3 font-mono text-slate-300">
            <span className="text-slate-400">SMC:</span>
            <span className="text-white font-semibold">
              {analysis.bias === 'LONG' ? 'Bullish' : analysis.bias === 'SHORT' ? 'Bearish' : 'Neutral'} Structure
            </span>
            <span className="text-slate-600">|</span>
            {ew && (
              <>
                <span className="text-slate-400">Elliott:</span>
                <span className="text-cyan-400 font-semibold">
                  {ew.description}
                </span>
                <span className="text-slate-600">|</span>
              </>
            )}
            <span className="text-slate-400">Entry:</span>
            <span className="text-amber-400">
              [${(analysis.entryZone?.min || currentPrice * 0.995).toFixed(2)} - ${(analysis.entryZone?.max || currentPrice * 1.005).toFixed(2)}]
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-emerald-400">● Bullish OB</span>
            <span className="text-rose-400">● Bearish OB</span>
            <span className="text-cyan-400">● Elliott Wave</span>
            <span className="text-amber-400">● FVG Imbalance</span>
          </div>
        </div>
      )}
    </div>
  );
};
