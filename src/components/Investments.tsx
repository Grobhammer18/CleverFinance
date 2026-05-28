import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvestmentProfile, Transaction, Debt, RiskLevel, MarketItem } from '../types';
import { Sparkles, TrendingUp, Wallet } from 'lucide-react';
import MarketAssetIcon from './MarketAssetIcon';
import { portfolioPowerBadgeFor } from '../portfolioMilestones';

interface InvestmentsProps {
  profile: InvestmentProfile;
  setProfile: (p: InvestmentProfile) => void;
  transactions: Transaction[];
  debts: Debt[];
  market: MarketItem[];
  portfolio: number;
}

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-8 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default function Investments({ profile, setProfile, market, portfolio }: InvestmentsProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {market.map((item) => (
          <Card key={item.sym} className="border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <MarketAssetIcon item={item} size={36} />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.sym}</p>
                    <p className="text-sm font-bold">{item.price.toLocaleString()}€</p>
                  </div>
                </div>
                <Badge
                  variant={item.change >= 0 ? 'default' : 'destructive'}
                  className={`${item.change >= 0 ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''} border-none text-[10px] px-1 h-5`}
                >
                  {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}%
                </Badge>
              </div>
              <Sparkline data={item.history} color={item.change >= 0 ? '#10b981' : '#ef4444'} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-none shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Investment strategy
            </CardTitle>
            <CardDescription>
              Set your risk level. We will expand this area with allocations and goals in a dedicated pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <label className="text-sm font-medium">Risk profile</label>
              <Select value={profile.riskLevel} onValueChange={(v: RiskLevel) => setProfile({ ...profile, riskLevel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low risk (safe & steady)</SelectItem>
                  <SelectItem value="medium">Medium risk (balanced)</SelectItem>
                  <SelectItem value="high">High risk (aggressive)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Portfolio value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio.toLocaleString()}€</div>
            {(() => {
              const b = portfolioPowerBadgeFor(portfolio);
              return b ? (
                <p className="text-xs mt-2 font-bold" style={{ color: b.color }}>
                  {b.emoji} {b.text}
                </p>
              ) : null;
            })()}
            <p className="text-[10px] mt-4 opacity-60">Live-Kurs • aktualisiert alle 3s</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl shadow-sm border border-dashed">
        <div className="h-16 w-16 rounded-full bg-primary/5 text-primary flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold">Investments</h3>
        <p className="text-muted-foreground max-w-md mt-2">
          Markets and risk live here; deeper portfolio tools are planned next.
        </p>
      </div>
    </div>
  );
}
