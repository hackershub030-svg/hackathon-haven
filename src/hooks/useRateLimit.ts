import { useState, useCallback, useRef } from 'react';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

interface UseRateLimitResult {
  checkRateLimit: () => boolean;
  isRateLimited: boolean;
  remainingAttempts: number;
  resetTime: number | null;
}

export function useRateLimit({ maxAttempts, windowMs }: RateLimitConfig): UseRateLimitResult {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [resetTime, setResetTime] = useState<number | null>(null);
  const attemptsRef = useRef<number[]>([]);

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    
    // Remove old attempts outside the window
    attemptsRef.current = attemptsRef.current.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (attemptsRef.current.length >= maxAttempts) {
      const oldestAttempt = attemptsRef.current[0];
      const resetAt = oldestAttempt + windowMs;
      setIsRateLimited(true);
      setResetTime(resetAt);
      
      // Set timeout to reset
      setTimeout(() => {
        setIsRateLimited(false);
        setResetTime(null);
      }, resetAt - now);
      
      return false;
    }

    // Record this attempt
    attemptsRef.current.push(now);
    return true;
  }, [maxAttempts, windowMs]);

  const remainingAttempts = Math.max(0, maxAttempts - attemptsRef.current.length);

  return {
    checkRateLimit,
    isRateLimited,
    remainingAttempts,
    resetTime,
  };
}
