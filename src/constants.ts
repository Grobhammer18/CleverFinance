import { Transaction, Debt, Achievement, MARKET_INITIAL } from "./types";

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: '2026-04-01', amount: 3000, type: 'income', category: 'Salary', description: 'Monthly Salary' },
  { id: 'tx-2', date: '2026-04-02', amount: 800, type: 'expense', category: 'Rent', description: 'Apartment Rent' },
  { id: 'tx-3', date: '2026-04-05', amount: 50, type: 'expense', category: 'Food', description: 'Groceries' },
  { id: 'tx-4', date: '2026-04-10', amount: 15, type: 'expense', category: 'Subscriptions', description: 'Netflix' },
];

export const INITIAL_DEBTS: Debt[] = [
  { id: 'debt-1', name: 'Dispokredit', totalAmount: 1200, remainingAmount: 820, interestRate: 12.5, monthlyPayment: 80, startDate: '2025-01-01' },
  { id: 'debt-2', name: 'Fensterfirma', totalAmount: 600, remainingAmount: 300, interestRate: 0, monthlyPayment: 50, startDate: '2025-06-01' },
  { id: 'debt-3', name: 'Familie', totalAmount: 400, remainingAmount: 400, interestRate: 0, monthlyPayment: 40, startDate: '2026-01-01' },
];

export const INITIAL_MARKET = MARKET_INITIAL;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_save', title: 'First Saver', description: 'Save your first 100€', icon: '💰' },
  { id: 'debt_free', title: 'Debt Free!', description: 'Pay off all your debts', icon: '🎉' },
  { id: 'investor', title: 'Young Investor', description: 'Start your first investment', icon: '📈' },
  { id: 'milestone_10k', title: '10k Club', description: 'Reach 10,000€ in assets', icon: '🏆' },
];
