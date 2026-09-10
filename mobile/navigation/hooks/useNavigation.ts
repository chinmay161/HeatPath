import { useContext } from 'react';
import { NavigationContext, type NavigationContextValue } from '../context';

/**
 * Primary hook for consuming navigation state and dispatching actions.
 * Ensures screens never manipulate state directly.
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a <NavigationProvider>.');
  }
  return context;
}
