/**
 * useAppForeground
 *
 * Triggers a callback whenever the app returns to the foreground.
 * Also fires on mount so the initial open is treated as a foreground event.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useAppForeground(callback) {
  const appStateRef = useRef(AppState.currentState);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Fire immediately on mount
    callbackRef.current();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        callbackRef.current();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
}
