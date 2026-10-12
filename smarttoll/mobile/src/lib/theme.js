// The SmartToll design system (same palette as smarttoll/frontend/src/styles.css).
export const colors = {
  greenDeep: '#0B4F3F',
  greenDark: '#12261F',
  greenMid: '#2F8F5B',
  greenPale: '#F0F6F2',
  amber: '#E8A33D',
  amberDark: '#B87A1F',
  amberPale: '#FCF0DB',
  red: '#C1442E',
  redPale: '#FBEAE6',
  concrete: '#F3F4EF',
  line: '#E2E4DC',
  white: '#FFFFFF',
  ink: '#14201C',
  inkSoft: '#5B6B63',
  inkFaint: '#93A099',
  mint: '#A9CDBB',     // soft text on the dark green
  // Map lines, as on the website
  tollRoad: '#0B4F3F',
  freeRoad: '#2F6FD6',
  entry: '#16A34A',
  exit: '#EA580C',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Condensed signage type for headings, like the expressway signs
  sign: 'BarlowCondensed_700Bold',
  signHeavy: 'BarlowCondensed_800ExtraBold',
};

export const radius = { sm: 6, md: 10, lg: 16 };

// Dark green header with white signage-type titles, like the website's top bar.
export const headerOptions = {
  headerStyle: { backgroundColor: colors.greenDark },
  headerTintColor: colors.white,
  headerTitleStyle: { fontFamily: fonts.sign, fontSize: 20 },
  headerShadowVisible: false,
};

export const shadow = {
  shadowColor: '#0B261F',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
