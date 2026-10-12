import { Alert, Platform } from 'react-native';

/**
 * "Are you sure?" with Cancel and one action button. Alert.alert does nothing in a web
 * browser, so there the browser's own confirm() is used instead.
 */
export function confirm(title, message, actionLabel, onConfirm, { cancelLabel = 'Cancel', destructive = true } = {}) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
