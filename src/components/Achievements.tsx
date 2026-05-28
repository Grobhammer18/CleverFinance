import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Achievement } from '../types';
import { CheckCircle2, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface AchievementsProps {
  achievements: Achievement[];
}

export default function Achievements({ achievements }: AchievementsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {achievements.map((achievement, idx) => (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <Card className={`relative overflow-hidden border-none shadow-md h-full ${achievement.unlockedAt ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-4xl">{achievement.icon}</span>
                {achievement.unlockedAt ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <Lock className="h-6 w-6 text-gray-300" />
                )}
              </div>
              <CardTitle className="text-lg">{achievement.title}</CardTitle>
              <CardDescription className="text-xs">{achievement.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {achievement.unlockedAt ? (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
                  Unlocked on {new Date(achievement.unlockedAt).toLocaleDateString()}
                </div>
              ) : (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Keep going to unlock!
                </div>
              )}
            </CardContent>
            {achievement.unlockedAt && (
              <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-green-500/10 rounded-full blur-2xl" />
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
