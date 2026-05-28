import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Zap } from 'lucide-react';
import { PRICING_TIERS } from '../types';
import { motion } from 'motion/react';

interface PricingProps {
  currentTier: string;
  onUpgrade: (tier: any, cycle: 'monthly' | 'yearly') => void;
}

export default function Pricing({ currentTier, onUpgrade }: PricingProps) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Wähle deinen Plan</h2>
        <p className="text-muted-foreground">Meistere deine Finanzen mit exklusiven Features.</p>
        
        <div className="flex items-center justify-center gap-4 pt-4">
          <span className={`text-sm ${cycle === 'monthly' ? 'font-bold' : 'text-muted-foreground'}`}>Monatlich</span>
          <button 
            onClick={() => setCycle(cycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-12 h-6 rounded-full bg-primary/20 transition-colors"
          >
            <motion.div 
              animate={{ x: cycle === 'monthly' ? 2 : 26 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-primary shadow-sm"
            />
          </button>
          <span className={`text-sm ${cycle === 'yearly' ? 'font-bold' : 'text-muted-foreground'}`}>
            Jährlich <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700 border-none">-20%</Badge>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const isCurrent = currentTier === tier.id;
          const price = cycle === 'monthly' ? tier.priceMonthly : tier.priceYearly;
          
          return (
            <Card key={tier.id} className={`relative flex flex-col border-none shadow-lg ${tier.isPopular ? 'ring-2 ring-primary' : ''}`}>
              {tier.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">Beliebteste Wahl</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="pt-2">
                  <span className="text-4xl font-bold">{price}€</span>
                  <span className="text-muted-foreground text-sm">/{cycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {tier.limitations?.map((limit) => (
                    <div key={limit} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-red-400 shrink-0" />
                      <span>{limit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full gap-2" 
                  variant={isCurrent ? 'outline' : tier.isPopular ? 'default' : 'secondary'}
                  disabled={isCurrent}
                  onClick={() => onUpgrade(tier.id, cycle)}
                >
                  {isCurrent ? 'Aktueller Plan' : tier.id === 'free' ? 'Kostenlos starten' : 'Jetzt upgraden'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
