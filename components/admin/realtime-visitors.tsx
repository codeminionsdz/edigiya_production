'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Users } from 'lucide-react';

type Visitor = {
  id: string;
  session_id: string;
  page_path: string;
  timestamp: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function RealtimeVisitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch initial visitors
    const fetchVisitors = async () => {
      try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: recentData, error: recentError } = await supabase
          .from('site_visitors')
          .select('*')
          .gte('timestamp', thirtyMinutesAgo)
          .order('timestamp', { ascending: false })
          .limit(20);

        if (recentError) throw recentError;

        setVisitors(recentData || []);

        // Get total for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count, error: countError } = await supabase
          .from('site_visitors')
          .select('*', { count: 'exact', head: true })
          .gte('timestamp', todayStart.toISOString());

        if (countError) throw countError;
        setTotalToday(count || 0);
      } catch (error) {
        console.error('Failed to fetch visitors:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitors();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('site_visitors')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'site_visitors',
        },
        (payload) => {
          setVisitors((prev) => [payload.new as Visitor, ...prev.slice(0, 19)]);
          setTotalToday((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPagePath = (path: string) => {
    if (!path || path === '/') return 'الموقع الرئيسي / Accueil';
    return path;
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>الزيارات المباشرة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              الزيارات المباشرة
            </CardTitle>
            <CardDescription>آخر 30 دقيقة</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">اليوم</p>
            <p className="text-2xl font-bold text-primary">{totalToday}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visitors.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">لا توجد زيارات حالياً</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      {formatPagePath(visitor.page_path)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {visitor.session_id.substring(0, 12)}...
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {formatTime(visitor.timestamp)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
