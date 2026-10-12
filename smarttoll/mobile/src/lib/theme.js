import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getItem, setItem } from './storage';

/*
 | The SmartToll design system (same palette as smarttoll/frontend/src/styles.css), in a light
 | and a dark version. The motorist picks Light, Dark or System (follow the phone) in Account.
 |
 | `colors` is one shared object whose values switch with the theme, so code keeps writing
 | colors.ink / colors.surface. Screens call useTheme() so they re-render on a switch, and
 | style sheets made with themed() rebuild themselves for the new colors.
 */
const light = {
  greenDeep: '#0B4F3F',   // brand green: primary buttons, links, icons
  greenDark: '#12261F',   // headers, dark banners (dark in both themes)
  greenMid: '#2F8F5B',
  greenPale: '#F0F6F2',   // tinted backgrounds (icon tiles, selected options, success notes)
  amber: '#E8A33D',
  amberDark: '#B87A1F',
  amberPale: '#FCF0DB',
  red: '#C1442E',
  redPale: '#FBEAE6',
  bluePale: '#EAF1FB',
  blue: '#2F6FD6',
  concrete: '#F3F4EF',    // page background
  surface: '#FFFFFF',     // cards, inputs, sheets, tab bar
  line: '#E2E4DC',
  white: '#FFFFFF',       // always white: text on green / amber, map casing
  ink: '#14201C',         // main text
  inkSoft: '#5B6B63',
  inkFaint: '#93A099',
  mint: '#A9CDBB',        // soft text on the dark green
  backdrop: 'rgba(11,38,31,0.45)',
  // Map lines, as on the website
  tollRoad: '#0B4F3F',
  freeRoad: '#2F6FD6',
  entry: '#16A34A',
  exit: '#EA580C',
};

const dark = {
  ...light,
  greenDeep: '#2E9E78',   // lifted so green text and icons stay readable on dark surfaces
  greenMid: '#3DB37A',
  greenPale: '#15302A',
  amberDark: '#E0A74F',
  amberPale: '#3A2C12',
  red: '#E5684F',
  redPale: '#3D1E19',
  bluePale: '#16263D',
  blue: '#6FA2F0',
  concrete: '#0E1513',
  surface: '#17211D',
  line: '#27352F',
  ink: '#E6EEEA',
  inkSoft: '#A7B8AF',
  inkFaint: '#74877D',
  backdrop: 'rgba(0,0,0,0.6)',
};

export const palettes = { light, dark };
export const colors = { ...light };

/* ---------- Theme switching ---------- */

const KEY = 'st_appearance';             // 'system' | 'light' | 'dark'
let version = 0;                         // bumps on every switch; themed() styles rebuild on it
const ThemeContext = createContext({ preference: 'system', dark: false, version: 0, setPreference: () => {} });

/** { preference, dark, setPreference }. Calling it also re-renders the component on a switch. */
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const system = useColorScheme();       // the phone's own light / dark setting
  const [preference, setPref] = useState('system');
  useEffect(() => {
    getItem(KEY).then((v) => { if (['system', 'light', 'dark'].includes(v)) setPref(v); }).catch(() => {});
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
  const value = useMemo(() => {
    // Switch the shared colors before anything below renders with them.
    Object.assign(colors, isDark ? dark : light);
    version += 1;
    return {
      preference, dark: isDark, version,
      setPreference: (p) => { setPref(p); setItem(KEY, p).catch(() => {}); },
    };
  }, [preference, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * A style sheet that follows the theme: themed(() => StyleSheet.create({...})) builds the
 * styles from the current colors, and builds them again after a switch.
 */
export function themed(build) {
  let built = null;
  let builtFor = -1;
  return new Proxy({}, {
    get(_, key) {
      if (builtFor !== version) { built = build(); builtFor = version; }
      return built[key];
    },
  });
}

/* ---------- Fixed design values ---------- */

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

// Dark green header with white signage-type titles, like the website's top bar (both themes).
export const headerOptions = {
  headerStyle: { backgroundColor: light.greenDark },
  headerTintColor: '#FFFFFF',
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
