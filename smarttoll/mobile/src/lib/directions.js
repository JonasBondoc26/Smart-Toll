/**
 * Spoken / on-screen English instructions from the route's maneuvers
 * (OSRM steps, as kept by TripPlannerService::directionsOf on the API):
 *   { type: 'turn', modifier: 'left', name: 'Tandang Sora Avenue' }  ->  "Turn left onto Tandang Sora Avenue"
 *   { type: 'off ramp', modifier: 'slight right', toward: 'E1, E5: Balintawak, Tarlac' }
 *                                                                     ->  "Take the exit on the right toward Balintawak, Tarlac"
 */

const roadOf = (s) => s.name || s.ref || null;

// Signs read "E1, E5: Balintawak, Tarlac"; the place names are what a driver looks for.
const towardOf = (s) => (s.toward ? s.toward.replace(/^[A-Z]?\d+[A-Z]?(\s*,\s*[A-Z]?\d+[A-Z]?)*\s*:\s*/, '') || s.toward : null);

const sideOf = (mod) => (mod?.includes('left') ? 'left' : mod?.includes('right') ? 'right' : null);

const TURN = {
  left: 'turn left', right: 'turn right',
  'slight left': 'bear left', 'slight right': 'bear right',
  'sharp left': 'turn sharp left', 'sharp right': 'turn sharp right',
  straight: 'continue straight', uturn: 'make a U-turn',
};

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** { text, icon } for one maneuver, or null for ones not worth saying (e.g. leaving a roundabout). */
export function instruction(s) {
  const road = roadOf(s);
  const toward = towardOf(s);
  const onto = road ? ` onto ${road}` : '';
  const side = sideOf(s.modifier);

  switch (s.type) {
    case 'depart':
      return { text: road ? `Head out on ${road}` : 'Start driving', icon: 'navigation-variant' };
    case 'arrive':
      return { text: 'You have arrived at your destination', icon: 'flag-checkered' };
    case 'end of road':
      return { text: `At the end of the road, ${TURN[s.modifier] || 'turn'}${onto}`, icon: iconOf(s.modifier) };
    case 'merge':
      return { text: road ? `Merge onto ${road}` : 'Merge', icon: 'call-merge' };
    case 'on ramp':
      return {
        text: `Take the ramp${side ? ` on the ${side}` : ''}${toward ? ` toward ${toward}` : onto}`,
        icon: iconOf(s.modifier || 'slight right'),
      };
    case 'off ramp':
      return {
        text: `Take the exit${side ? ` on the ${side}` : ''}${toward ? ` toward ${toward}` : onto}`,
        icon: iconOf(s.modifier || 'slight right'),
      };
    case 'fork':
      return { text: `Keep ${side || 'straight'}${toward ? ` toward ${toward}` : road ? ` on ${road}` : ''}`, icon: side === 'left' ? 'arrow-top-left' : side === 'right' ? 'arrow-top-right' : 'arrow-up' };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn': {
      const nth = s.exit ? ` take the ${ORDINAL[s.exit - 1] || `${s.exit}th`} exit` : ' continue';
      return { text: `At the roundabout,${nth}${onto}`, icon: 'rotate-left' };
    }
    case 'exit roundabout':
    case 'exit rotary':
    case 'notification':
      return null;
    case 'new name':
    case 'continue':
      if (s.modifier === 'uturn') return { text: `Make a U-turn${onto}`, icon: 'arrow-u-left-top' };
      if (s.modifier && s.modifier !== 'straight') return { text: `${cap(TURN[s.modifier] || 'continue')}${onto}`, icon: iconOf(s.modifier) };
      return { text: road ? `Continue onto ${road}` : 'Continue straight', icon: 'arrow-up' };
    default: // 'turn' and anything new
      return { text: `${cap(TURN[s.modifier] || 'continue')}${onto}`, icon: iconOf(s.modifier) };
  }
}

function iconOf(mod) {
  switch (mod) {
    case 'left': case 'sharp left': return 'arrow-left-top';
    case 'right': case 'sharp right': return 'arrow-right-top';
    case 'slight left': return 'arrow-top-left';
    case 'slight right': return 'arrow-top-right';
    case 'uturn': return 'arrow-u-left-top';
    default: return 'arrow-up';
  }
}

/** "In 400 meters", "In 1.5 kilometers" — rounded the way a driver hears it. */
export function inDistance(m) {
  if (m >= 950) {
    const k = Math.round(m / 500) / 2;   // nearest half kilometer
    return `In ${k % 1 ? k.toFixed(1) : k} kilometer${k === 1 ? '' : 's'}`;
  }
  return `In ${Math.max(50, Math.round(m / 50) * 50)} meters`;
}

/** On-screen distance: "350 m", "2.4 km". */
export const shortDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);

/** Expressway maneuvers come at speed, so they're announced earlier. */
export const isHighway = (s) => ['on ramp', 'off ramp', 'fork', 'merge'].includes(s.type);

/** Peso amounts read naturally by the voice: "266 pesos". */
export const pesosSpoken = (n) => `${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })} pesos`;
