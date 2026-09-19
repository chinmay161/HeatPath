import { useContext } from 'react';
import {
  NavigationContext,
  NavigationStateContext,
  NavigationTelemetryContext,
  NavigationActionsContext,
  NavigationDiagnosticsContext,
  type NavigationContextValue,
  type NavigationStateContextValue,
  type NavigationTelemetryContextValue,
  type NavigationActionsContextValue,
  type NavigationDiagnosticsContextValue,
} from '../context';

/**
 * Primary composite hook for consuming full navigation context.
 * Provided for backward compatibility across existing screens and tests.
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a <NavigationProvider>.');
  }
  return context;
}

/**
 * Hook for consuming low-frequency navigation state (session, route, progress).
 * Components subscribing here do NOT re-render on high-frequency GPS ticks.
 */
export function useNavigationState(): NavigationStateContextValue {
  const context = useContext(NavigationStateContext);
  if (!context) {
    throw new Error('useNavigationState must be used within a <NavigationProvider>.');
  }
  return context;
}

/**
 * Hook for consuming high-frequency GPS telemetry (location, heading, speed, health).
 */
export function useNavigationTelemetry(): NavigationTelemetryContextValue {
  const context = useContext(NavigationTelemetryContext);
  if (!context) {
    throw new Error('useNavigationTelemetry must be used within a <NavigationProvider>.');
  }
  return context;
}

/**
 * Hook for consuming stable action handlers (start, pause, resume, stop, reroute).
 * Functions have stable identity and NEVER trigger component re-renders.
 */
export function useNavigationActions(): NavigationActionsContextValue {
  const context = useContext(NavigationActionsContext);
  if (!context) {
    throw new Error('useNavigationActions must be used within a <NavigationProvider>.');
  }
  return context;
}

/**
 * Hook for consuming navigation diagnostics and route status (off-route, reroute, arrival).
 */
export function useNavigationDiagnostics(): NavigationDiagnosticsContextValue {
  const context = useContext(NavigationDiagnosticsContext);
  if (!context) {
    throw new Error('useNavigationDiagnostics must be used within a <NavigationProvider>.');
  }
  return context;
}
