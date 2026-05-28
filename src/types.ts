export type TransactionType = 'income' | 'expense';

export type SubscriptionTier = 'free' | 'pro' | 'elite';

export interface UserSubscription {
  tier: SubscriptionTier;
  billingCycle: 'monthly' | 'yearly';
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
}

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface InvestmentProfile {
  riskLevel: RiskLevel;
  preferences: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Nebenjob', 'Sonstiges'],
  expense: ['Essen & Trinken', 'Fahrtkosten', 'Abos', 'Miete', 'Kleidung', 'Gesundheit', 'Freizeit', 'Sonstiges']
};

export interface MarketItem {
  sym: string;
  name: string;
  price: number;
  change: number;
  icon: string;
  logoUrl?: string;
  history: number[];
}

export const MARKET_INITIAL: MarketItem[] = [
  { sym: "BTC", name: "Bitcoin", price: 84320, change: 2.4, icon: "₿", logoUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png", history: Array.from({ length: 10 }, () => 84000 + Math.random() * 1000) },
  { sym: "ETH", name: "Ethereum", price: 3210, change: -1.1, icon: "Ξ", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", history: Array.from({ length: 10 }, () => 3200 + Math.random() * 100) },
  { sym: "SPY", name: "S&P 500 ETF", price: 512, change: 0.7, icon: "📈", logoUrl: "https://financialmodelingprep.com/image-stock/SPY.png", history: Array.from({ length: 10 }, () => 510 + Math.random() * 10) },
  { sym: "AAPL", name: "Apple", price: 178, change: 1.2, icon: "🍎", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/31/Apple_logo_white.svg", history: Array.from({ length: 10 }, () => 175 + Math.random() * 5) },
  { sym: "MSCI", name: "MSCI World", price: 98.4, change: 0.4, icon: "🌍", logoUrl: "https://financialmodelingprep.com/image-stock/MSCI.png", history: Array.from({ length: 10 }, () => 98 + Math.random() * 2) },
];

export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    features: ['Basic Tracking', 'Manual Entry', 'Debt Overview'],
    limitations: ['No AI Advice', 'No Live Data', 'No Annual Reports']
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    features: ['AI Recommendations', 'Live Market Data', 'Annual Reports', 'Export Data'],
    isPopular: true
  },
  {
    id: 'elite',
    name: 'Elite',
    priceMonthly: 19.99,
    priceYearly: 199.99,
    features: ['Everything in Pro', 'Priority Support', 'Advanced Analytics', 'Tax Optimization Tips']
  }
];
