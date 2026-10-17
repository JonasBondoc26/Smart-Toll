import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getItem, setItem } from './storage';

/*
 | The SmartToll design system (same palette as smarttoll/frontend/src/styles.css), in a light
 | and a dark version: soft rounded cards on a pale mint ground, pill buttons, Manrope type. The motorist picks Light, Dark or System (follow the phone) in Account.
 |
 | `colors` is one shared object whose values switch with the theme, so code keeps writing
 | colors.ink / colors.surface. Screens call useTheme() so they re-render on a switch, and
 | style sheets made with themed() rebuild themselves for the new colors.
 */
const light = {
  greenDeep: '#0B4F3F',   // sign green: links, icons, selected options, the toll-road line
  greenDark: '#12261F',   // overhead green: the trip screen's gantry banners (dark in both themes)
  greenMid: '#2F8F5B',
  greenPale: '#E2F0E8',   // pastel green wash: tiles, selected options, success notes
  amber: '#E8A33D',       // lane amber: the one "go" action
  amberDark: '#A86E18',
  amberPale: '#FCEFD8',
  red: '#C1442E',
  redPale: '#FBE8E3',
  bluePale: '#E4EEFB',
  blue: '#2F6FD6',
  concrete: '#EEF3EF',    // page ground: pale mint-grey
  surface: '#FFFFFF',     // cards, sheets, tab bar
  field: '#F5F8F6',       // borderless fields and options (lighter than the ground, tinted inside cards)
  cardEdge: '#FFFFFF',    // card outline: invisible by day (the soft shadow carries the edge)
  line: '#E1E8E3',
  action: '#12261F',      // primary pill buttons: near-black overhead green
  onAction: '#FFFFFF',
  white: '#FFFFFF',       // always white: text on green / amber, map casing
  ink: '#14201C',         // main text
  inkSoft: '#55665D',
  inkFaint: '#5F6F66',
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
  greenPale: '#163327',
  amberDark: '#E0A74F',
  amberPale: '#3A2C12',
  red: '#E5684F',
  redPale: '#3D1E19',
  bluePale: '#16263D',
  blue: '#6FA2F0',
  concrete: '#0D1412',
  surface: '#16201C',
  field: '#1D2924',
  cardEdge: '#25332D',    // at night shadows don't show, so cards keep a quiet outline
  line: '#25332D',
  action: '#DCEBE3',      // light pill on dark, the same role inverted
  onAction: '#0D1412',
  ink: '#E6EEEA',
  inkSoft: '#A7B8AF',
  inkFaint: '#8A9C92',
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
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',     // figures: pesos, kilometres, times
  // Condensed signage type, kept for the trip screen's driving information (gantry signs)
  sign: 'BarlowCondensed_700Bold',
  signHeavy: 'BarlowCondensed_800ExtraBold',
};

export const radius = { sm: 8, md: 16, lg: 24, pill: 999 };

// A light header on the page ground with a dark title (both follow the theme).
export const headerOptions = () => ({
  headerStyle: { backgroundColor: colors.concrete },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.4 },
  headerShadowVisible: false,
});

// One soft, green-tinted lift for cards and the tab bar.
export const shadow = {
  shadowColor: '#0B261F',
  shadowOpacity: 0.07,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};
