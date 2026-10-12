import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './api';

/**
 * "Continue with Google" on the phone, with Google's native account chooser
 * (@react-native-google-signin/google-signin).
 *
 * Google issues an ID token for the SmartToll WEB client ID (the same GOOGLE_CLIENT_ID the
 * website uses, read from the API), and the API verifies it exactly like a sign-in from the
 * website (POST /api/auth/google). Google also checks the app itself: the phone's build must
 * match the Android OAuth client (package ph.edu.hau.smarttoll + its SHA-1). See README.
 *
 * The native code is not in Expo Go or in a web browser, so there the library is never loaded.
 */
export const googleAvailableHere = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let native = null;
const lib = () => {
  if (!native) native = require('@react-native-google-signin/google-signin');
  return native;
};

let clientIdRequest = null;
/** The server's Google client ID, or null when Google sign-in is turned off there. Asked once. */
export const googleClientId = () => {
  if (!clientIdRequest) {
    clientIdRequest = api('/auth/google/config').then((d) => d.client_id).catch(() => { clientIdRequest = null; return null; });
  }
  return clientIdRequest;
};

/** Shows Google's account chooser. Resolves to an ID token, or null when the person cancels. */
export async function googleIdToken() {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = lib();
  const webClientId = await googleClientId();
  if (!webClientId) throw new Error('Google sign-in is not set up on the SmartToll server (GOOGLE_CLIENT_ID).');
  GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined });

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut().catch(() => {});   // always offer the account chooser
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;      // cancelled
    return res.data.idToken || (await GoogleSignin.getTokens()).idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services is missing or out of date on this phone.');
    }
    // Android's code 10 (DEVELOPER_ERROR): Google does not recognise this build of the app.
    if (String(e.code) === '10' || /DEVELOPER_ERROR/i.test(e.message || '')) {
      throw new Error("Google doesn't recognise this build of SmartToll. Add its SHA-1 to the Android OAuth client in Google Cloud (see README → Mobile app → Google sign-in).");
    }
    throw new Error(e.message || 'Google sign-in failed. Please try again.');
  }
}

/** Forget the Google account on the phone (on log out), so the chooser appears next time. */
export async function googleSignOut() {
  if (!googleAvailableHere) return;
  try {
    await lib().GoogleSignin.signOut();
  } catch {
    // not signed in with Google, or not configured yet: nothing to forget
  }
}
