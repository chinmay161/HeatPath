/**
 * NavigationContext.tsx
 *
 * Composite navigation context for backward compatibility.
 * Combines NavigationStateContext, NavigationTelemetryContext,
 * NavigationActionsContext, and NavigationDiagnosticsContext.
 */

import { createContext } from 'react';
import type { NavigationStateContextValue } from './NavigationStateContext';
import type { NavigationTelemetryContextValue } from './NavigationTelemetryContext';
import type { NavigationActionsContextValue } from './NavigationActionsContext';
import type { NavigationDiagnosticsContextValue } from './NavigationDiagnosticsContext';

export interface NavigationContextValue
  extends NavigationStateContextValue,
    NavigationTelemetryContextValue,
    NavigationActionsContextValue,
    NavigationDiagnosticsContextValue {}

export const NavigationContext = createContext<NavigationContextValue | null>(null);
