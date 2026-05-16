import { useEffect, useState } from 'react';

/**
 * A hook that subscribes to a WatermelonDB observable (Query or Model)
 * and returns the latest emitted value.
 * 
 * @param {Observable | Query} observableOrQuery - The WatermelonDB observable or query to subscribe to.
 * @param {any} initialValue - The initial value until the first emission.
 * @returns {any} The latest value from the observable.
 */
export function useObservable(observableOrQuery, initialValue = []) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!observableOrQuery) return;
    
    // If it's a WatermelonDB Query, we need to call .observe() to get the observable
    const observable = typeof observableOrQuery.observe === 'function' 
      ? observableOrQuery.observe() 
      : observableOrQuery;

    if (typeof observable.subscribe !== 'function') {
      console.warn('[useObservable] Received an object that cannot be subscribed to:', observableOrQuery);
      return;
    }

    const subscription = observable.subscribe((newValue) => {
      setValue(newValue);
    });

    return () => subscription.unsubscribe();
  }, [observableOrQuery]);

  return value;
}
