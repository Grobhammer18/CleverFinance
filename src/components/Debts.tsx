import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Debt } from '../types';
import { Trophy, ArrowDownRight, Info } from 'lucide-react';

interface DebtsProps {
  debts: Debt[];
  onPay: (id: string, amount: number) => void;
}

export default function Debts({ debts, onPay }: DebtsProps) {
  const [payAmount, setPayAmount] = useState<string>('');
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);

  const handlePay = (id: string) => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    onPay(id, amount);
    setPayAmount('');
    setSelectedDebtId(null);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {debts.map((debt) => {
        const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100;
        
        return (
          <Card key={debt.id} className="border-none shadow-md overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{debt.name}</CardTitle>
                <span className="text-sm font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  {debt.interestRate}% Interest
                </span>
              </div>
              <CardDescription>Started on {new Date(debt.startDate).toLocaleDateString('de-DE')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-bold">{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Paid: {(debt.totalAmount - debt.remainingAmount).toLocaleString()}€</span>
                  <span>Total: {debt.totalAmount.toLocaleString()}€</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining</p>
                  <p className="text-xl font-bold text-red-600">{debt.remainingAmount.toLocaleString()}€</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly</p>
                  <p className="text-xl font-bold">{debt.monthlyPayment.toLocaleString()}€</p>
                </div>
              </div>

              <Dialog open={selectedDebtId === debt.id} onOpenChange={(open) => !open && setSelectedDebtId(null)}>
                <DialogTrigger 
                  render={
                    <Button className="w-full gap-2" variant="outline" onClick={() => setSelectedDebtId(debt.id)}>
                      <ArrowDownRight className="h-4 w-4" /> Make a Payment
                    </Button>
                  } 
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Pay off {debt.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Payment Amount (€)</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" onClick={() => handlePay(debt.id)}>Confirm Payment</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        );
      })}

      {debts.length === 0 && (
        <Card className="col-span-full border-dashed border-2 bg-transparent flex flex-col items-center justify-center p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
            <Trophy className="h-8 w-8" />
          </div>
          <CardTitle className="mb-2">You are Debt Free!</CardTitle>
          <CardDescription>Great job! Now you can focus on building your wealth.</CardDescription>
        </Card>
      )}
    </div>
  );
}
