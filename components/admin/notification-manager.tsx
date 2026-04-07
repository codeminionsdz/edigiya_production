'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// VAPID public key - عليك إنشاء واحد من خدمة Push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (supported) {
      checkSubscriptionStatus();
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const registerServiceWorker = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        toast.error('المتصفح لا يدعم Service Workers');
        return;
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Error registering service worker:', error);
      toast.error('فشل تسجيل Service Worker');
      return null;
    }
  };

  const subscribeToNotifications = async () => {
    if (!isSupported) {
      toast.error('متصفحك لا يدعم الإشعارات');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error('مفتاح VAPID غير محدد');
      return;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('تم رفض إذن الإشعارات');
        setIsLoading(false);
        return;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to database
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error } = await supabase.from('admin_notification_subscriptions').insert([
        {
          admin_id: 'admin_main', // In production, use actual admin ID
          subscription_token: JSON.stringify(subscription.toJSON()),
          device_info: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        },
      ]);

      if (error) throw error;

      setIsSubscribed(true);
      toast.success('تم تفعيل الإشعارات بنجاح');
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('فشل تفعيل الإشعارات');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromNotifications = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const token = JSON.stringify(subscription.toJSON());
        await supabase
          .from('admin_notification_subscriptions')
          .delete()
          .eq('subscription_token', token);
      }

      setIsSubscribed(false);
      toast.success('تم تعطيل الإشعارات');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('فشل تعطيل الإشعارات');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
        <p className="text-sm text-amber-800 dark:text-amber-400">
          متصفحك لا يدعم نظام الإشعارات
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">إشعارات الطلبيات</p>
            <p className="text-sm text-muted-foreground">تلقي إشعارات فوراً عند وصول طلبيات جديدة</p>
          </div>
        </div>
        {isSubscribed && <CheckCircle className="h-5 w-5 text-green-500" />}
        {!isSubscribed && <AlertCircle className="h-5 w-5 text-amber-500" />}
      </div>

      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              مفعل
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={unsubscribeFromNotifications}
              disabled={isLoading}
            >
              {isLoading ? 'جاري التعطيل...' : 'تعطيل الإشعارات'}
            </Button>
          </>
        ) : (
          <>
            <Badge variant="outline">معطل</Badge>
            <Button
              size="sm"
              onClick={subscribeToNotifications}
              disabled={isLoading}
            >
              {isLoading ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
