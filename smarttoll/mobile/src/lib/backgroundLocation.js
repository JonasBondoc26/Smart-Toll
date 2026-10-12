import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { inExpoGo } from './google';

/**
 * GPS that keeps working when the phone is locked or another app is open, so a trip keeps
 * being followed (with spoken directions and toll alerts). Android shows a "SmartToll is
 * following your trip" notification while it runs, as the system requires.
 *
 * Not available in Expo Go or a web browser; there the trip screen uses foreground GPS only.
 */
export const TASK = 'smarttoll-trip-location';
export const backgroundAvailable = Platform.OS !== 'web' && !inExpoGo;

let listener = null;
/** Where background fixes go: the tracking engine, while a trip is being followed. */
export const setBackgroundListener = (fn) => { listener = fn; };

// Must be defined when the app's JavaScript loads (imported from the root layout).
if (backgroundAvailable) {
  TaskManager.defineTask(TASK, ({ data, error }) => {
    if (error || !data?.locations) return;
    // A mistake here must not crash the app (an installed APK closes on any uncaught error).
    try {
      for (const loc of data.locations) listener?.(loc);
    } catch (e) {
      console.warn('Background location fix failed', e);
    }
  });
}

/**
 * Ask for "Allow all the time" location. Android 11+ opens the system settings page for this,
 * so the trip screen explains it first. Resolves to true when granted.
 */
export async function askBackgroundPermission() {
  if (!backgroundAvailable) return false;
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted;
}

export async function hasBackgroundPermission() {
  if (!backgroundAvailable) return false;
  return (await Location.getBackgroundPermissionsAsync()).granted;
}

export async function startBackground(destination) {
  await stopBackground();
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SmartToll is following your trip',
      notificationBody: `Directions and toll alerts to ${destination} continue while the phone is locked.`,
      notificationColor: '#0B4F3F',
      killServiceOnDestroy: true,
    },
  });
}

export async function stopBackground() {
  if (!backgroundAvailable) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    // not running
  }
}
