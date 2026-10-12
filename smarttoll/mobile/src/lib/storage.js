import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The phone's secure storage (Keychain / Keystore). In a web browser, where SecureStore
// does not exist, localStorage stands in so the app can be tried on a computer too.
const web = Platform.OS === 'web';

export const getItem = async (key) => (web ? localStorage.getItem(key) : SecureStore.getItemAsync(key));
export const setItem = async (key, value) => (web ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value));
export const removeItem = async (key) => (web ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key));
