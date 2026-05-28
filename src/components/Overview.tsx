import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, Debt, MONTHS } from '../types';
import { ArrowUpRight, ArrowDownRight, Target, AlertCircle } from 'lucide-react';

interface OverviewProps {
  transactions: Transaction[];
  debts: Debt[];
}

export default function Overview({ transactions, debts }: OverviewProps) {
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expense: number }> = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      if (!data[month]) data[month] = { month, income: 0, expense: 0 };
      if (t.type === 'income') data[month].income += t.amount;
      else data[month].expense += t.amount;
    });

    return Object.values(data);
  }, [transactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      data[t.category] = (data[t.category] || 0) + t.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Balance</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(totalIncome - totalExpenses).toLocaleString('de-DE')}€</div>
          <p className="text-xs text-muted-foreground">
            {savingsRate.toFixed(1)}% savings rate
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalDebt.toLocaleString('de-DE')}€</div>
          <p className="text-xs text-muted-foreground">
            {debts.length} active loans
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-3 border-none shadow-md">
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}€`} />
              <Tooltip 
                cursor={{ fill: '#f8f9fa' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-1 border-none shadow-md">
        <CardHeader>
          <CardTitle>Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="col-span-full border-none shadow-md">
        <CardHeader>
          <CardTitle>Jahresübersicht 2026</CardTitle>
          <CardDescription>Monatlicher Saldo im Überblick</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-24 mb-4">
            {MONTHS.map((m, i) => {
              const monthDataForM = transactions.filter(t => new Date(t.date).getMonth() === i);
              const income = monthDataForM.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
              const expense = monthDataForM.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
              const saldo = income - expense;
              const isPos = saldo >= 0;
              const height = Math.min(100, Math.max(10, (Math.abs(saldo) / 2000) * 100));
              
              return (
                <div key={`${m}-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div 
                    className={`w-full rounded-t-sm transition-all duration-500 ${isPos ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{m}</span>
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-[10px] p-1 rounded whitespace-nowrap z-10">
                    {saldo.toLocaleString()}€
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full" /> Plus</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full" /> Minus</span>
            </div>
            <div className="text-sm font-bold">
              Jahres-Saldo: {transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0).toLocaleString()}€
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

