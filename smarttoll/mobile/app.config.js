// Extends app.json. Google Sign-In needs no config plugin on Android (without Firebase);
// on iOS it needs the iOS OAuth client's URL scheme, so the plugin is added only when
// GOOGLE_IOS_URL_SCHEME is set (e.g. com.googleusercontent.apps.1234-abcd). See README → Mobile app.
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    plugins: [
      ...config.plugins,
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]] : []),
    ],
  };
};
