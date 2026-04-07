'use client';

import { useEffect } from 'react';

export function VisitorTracker() {
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        // Get or create session ID
        let sessionId = localStorage.getItem('visitor_session_id');
        if (!sessionId) {
          sessionId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('visitor_session_id', sessionId);
        }

        // Send visitor data
        const response = await fetch('/api/track-visitor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            page_path: window.location.pathname,
            referrer: document.referrer || null,
          }),
        });

        if (!response.ok) {
          console.error('Failed to track visitor');
        }
      } catch (error) {
        console.error('Error tracking visitor:', error);
      }
    };

    trackVisitor();
  }, []);

  return null;
}
