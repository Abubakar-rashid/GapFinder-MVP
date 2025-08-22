"use client";

import { useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';

export default function Home() {
  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getCurrentUser();
      if (user) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/auth';
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
    </div>
  );
}