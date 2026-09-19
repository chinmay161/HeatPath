/**
 * config.ts
 *
 * Configurable thresholds and tuning parameters for intelligent navigation.
 * All thresholds are centralized here — no magic numbers in code.
 */

export interface NavigationThresholds {
  /**
   * Perpendicular distance threshold from route polyline to trigger off-route candidate (meters).
   * Default: 25 meters (accounts for standard pedestrian path width and sidewalk buffer).
   */
  readonly OFF_ROUTE_DISTANCE_METERS: number;

  /**
   * Number of consecutive off-route GPS samples required before confirming off-route.
   * Prevents false triggers from single GPS spikes or multipath reflections.
   */
  readonly OFF_ROUTE_CONFIRMATION_COUNT: number;

  /**
   * Minimum elapsed seconds a user must remain beyond the threshold before rerouting.
   * Default: 8 seconds.
   */
  readonly OFF_ROUTE_TIME_SECONDS: number;

  /**
   * Minimum cooldown seconds between successive backend reroute requests.
   * Prevents spamming the routing server during continuous wandering.
   */
  readonly REROUTE_COOLDOWN_SECONDS: number;

  /**
   * Distance threshold to consider user back on route (meters).
   * Default: 15 meters (tighter than off-route to ensure solid recovery).
   */
  readonly RECOVERY_DISTANCE_METERS: number;

  /**
   * Critical divergence distance where off-route is confirmed immediately (meters).
   * If user is > 65m away with good GPS fix, no need to wait full confirmation count.
   */
  readonly CRITICAL_DIVERGENCE_DISTANCE_METERS: number;

  /**
   * Angle divergence between walking heading and route segment bearing (degrees)
   * beyond which movement is considered intentionally away from route.
   */
  readonly HEADING_DIVERGENCE_THRESHOLD_DEG: number;

  /**
   * Max GPS horizontal accuracy uncertainty allowed for immediate off-route trigger (meters).
   * If GPS accuracy > 35m, we do not confirm off-route unless distance far exceeds accuracy.
   */
  readonly MAX_GPS_ACCURACY_THRESHOLD_M: number;

  /**
   * Minimum pedestrian speed (m/s) required to evaluate heading divergence (~1.8 km/h).
   * Stationary or slow users don't have reliable directional headings.
   */
  readonly MIN_WALKING_SPEED_FOR_HEADING_MPS: number;

  /**
   * Distance before turn to announce 'prepare' instruction (meters).
   */
  readonly PREPARE_MANEUVER_DISTANCE_METERS: number;

  /**
   * Distance before turn to announce 'turn now' instruction (meters).
   */
  readonly TURN_MANEUVER_DISTANCE_METERS: number;

  /**
   * Distance after turn to advance to next step instruction (meters).
   */
  readonly PASSED_MANEUVER_DISTANCE_METERS: number;

  /**
   * Distance from destination to announce 'destination approaching' (meters).
   */
  readonly ARRIVAL_APPROACHING_DISTANCE_METERS: number;

  /**
   * Distance from destination to confirm arrival (meters).
   */
  readonly ARRIVAL_CONFIRMED_DISTANCE_METERS: number;

  /**
   * Minimum percentage improvement in comfort score required to highlight route improvement.
   */
  readonly MIN_IMPROVEMENT_PCT_TO_NOTIFY: number;
}

export const DEFAULT_NAVIGATION_THRESHOLDS: NavigationThresholds = {
  OFF_ROUTE_DISTANCE_METERS: 25,
  OFF_ROUTE_CONFIRMATION_COUNT: 3,
  OFF_ROUTE_TIME_SECONDS: 8,
  REROUTE_COOLDOWN_SECONDS: 15,
  RECOVERY_DISTANCE_METERS: 15,
  CRITICAL_DIVERGENCE_DISTANCE_METERS: 65,
  HEADING_DIVERGENCE_THRESHOLD_DEG: 65,
  MAX_GPS_ACCURACY_THRESHOLD_M: 35,
  MIN_WALKING_SPEED_FOR_HEADING_MPS: 0.5,
  PREPARE_MANEUVER_DISTANCE_METERS: 100,
  TURN_MANEUVER_DISTANCE_METERS: 30,
  PASSED_MANEUVER_DISTANCE_METERS: 10,
  ARRIVAL_APPROACHING_DISTANCE_METERS: 50,
  ARRIVAL_CONFIRMED_DISTANCE_METERS: 15,
  MIN_IMPROVEMENT_PCT_TO_NOTIFY: 5.0,
};
