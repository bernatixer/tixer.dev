// ============================================
// THEME SYSTEM
// ============================================
//
// Two themes extracted from the existing UI:
//   - cyberDark: formalized from the current "Cyber Dark" aesthetic
//   - softLight: a calm, modern light counterpart
//
// Key differences:
//   Cyber Dark — high contrast, neon accent (#BFFF00), deep black base,
//   hard geometric shadows, futuristic/cyberpunk energy.
//   Soft Light — low contrast, warm neutrals, soft diffused shadows,
//   breathable spacing, inspired by Notion/Airbnb calm.
//
// Accessibility notes:
//   - Both themes maintain WCAG AA contrast for body text (4.5:1+)
//   - Cyber Dark: bone (#F5F5F0) on void (#0A0A0A) = 18.1:1
//   - Soft Light: primary text (#1F1F1F) on background (#FAFAF9) = 16.5:1
//   - Interactive states use visible focus rings in both themes
//   - Semantic colors (error, warning, etc.) are adjusted per theme
//     to meet contrast requirements against their respective backgrounds

export interface Theme {
  name: string

  colors: {
    // Backgrounds
    background: {
      base: string
      surface: string
      elevated: string
      overlay: string
    }

    // Text
    text: {
      primary: string
      secondary: string
      disabled: string
      inverse: string
    }

    // Borders
    border: {
      default: string
      subtle: string
      strong: string
    }

    // Brand / primary
    primary: {
      base: string
      hover: string
      active: string
      subtle: string       // low-opacity background tint
      text: string         // text on primary background
    }

    // Secondary accent
    secondary: {
      base: string
      hover: string
      subtle: string
    }

    // Semantic
    success: string
    warning: string
    error: string
    info: string

    // Priority (domain-specific)
    priority: {
      urgent: string
      high: string
      medium: string
      low: string
    }
  }

  // Interactive states applied as overlays or modifiers
  states: {
    hover: string          // overlay color
    active: string
    focus: string          // focus ring color
    selected: string       // selected item background
  }

  shadows: {
    sm: string
    md: string
    lg: string
    hard: string           // the geometric offset shadow
    glow: string           // accent glow effect
    focus: string          // focus ring shadow
  }

  radius: {
    none: string
    sm: string
    md: string
    full: string
  }

  typography: {
    fontFamily: string
    fontMono: string
  }
}

// ============================================
// CYBER DARK
// ============================================

export const cyberDark: Theme = {
  name: 'cyberDark',

  colors: {
    background: {
      base: '#0A0A0A',
      surface: 'rgba(255, 255, 255, 0.03)',
      elevated: 'rgba(255, 255, 255, 0.06)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },

    text: {
      primary: '#F5F5F0',
      secondary: 'rgba(245, 245, 240, 0.55)',
      disabled: 'rgba(245, 245, 240, 0.25)',
      inverse: '#0A0A0A',
    },

    border: {
      default: 'rgba(255, 255, 255, 0.08)',
      subtle: 'rgba(255, 255, 255, 0.04)',
      strong: 'rgba(255, 255, 255, 0.15)',
    },

    primary: {
      base: '#BFFF00',
      hover: '#D4FF4D',
      active: '#A8E600',
      subtle: 'rgba(191, 255, 0, 0.08)',
      text: '#0A0A0A',
    },

    secondary: {
      base: '#7964FF',
      hover: '#9484FF',
      subtle: 'rgba(121, 100, 255, 0.1)',
    },

    success: '#4ADE80',
    warning: '#FFD166',
    error: '#FF4444',
    info: '#3B82F6',

    priority: {
      urgent: '#FF4444',
      high: '#FF9500',
      medium: '#BFFF00',
      low: '#666666',
    },
  },

  states: {
    hover: 'rgba(255, 255, 255, 0.04)',
    active: 'rgba(255, 255, 255, 0.08)',
    focus: '#BFFF00',
    selected: 'rgba(191, 255, 0, 0.05)',
  },

  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.4)',
    md: '0 8px 24px rgba(0, 0, 0, 0.6)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.8)',
    hard: '8px 8px 0 #BFFF00',
    glow: '0 0 12px rgba(191, 255, 0, 0.4)',
    focus: '0 0 0 1px #BFFF00',
  },

  radius: {
    none: '0px',
    sm: '2px',
    md: '3px',
    full: '999px',
  },

  typography: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
}

// ============================================
// SOFT LIGHT
// ============================================

export const softLight: Theme = {
  name: 'softLight',

  colors: {
    background: {
      base: '#FAFAF9',
      surface: '#FFFFFF',
      elevated: '#FFFFFF',
      overlay: 'rgba(0, 0, 0, 0.08)',
    },

    text: {
      primary: '#1F1F1F',
      secondary: '#71717A',
      disabled: '#B4B4BB',
      inverse: '#FAFAF9',
    },

    border: {
      default: 'rgba(0, 0, 0, 0.08)',
      subtle: 'rgba(0, 0, 0, 0.04)',
      strong: 'rgba(0, 0, 0, 0.15)',
    },

    primary: {
      base: '#7964FF',
      hover: '#6B54F0',
      active: '#5C45E0',
      subtle: 'rgba(121, 100, 255, 0.08)',
      text: '#FFFFFF',
    },

    secondary: {
      base: '#BFFF00',
      hover: '#A8E600',
      subtle: 'rgba(191, 255, 0, 0.1)',
    },

    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    info: '#2563EB',

    priority: {
      urgent: '#DC2626',
      high: '#EA580C',
      medium: '#7964FF',
      low: '#A1A1AA',
    },
  },

  states: {
    hover: 'rgba(0, 0, 0, 0.03)',
    active: 'rgba(0, 0, 0, 0.06)',
    focus: '#7964FF',
    selected: 'rgba(121, 100, 255, 0.06)',
  },

  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.1)',
    hard: '4px 4px 0 rgba(121, 100, 255, 0.25)',
    glow: '0 0 8px rgba(121, 100, 255, 0.2)',
    focus: '0 0 0 2px rgba(121, 100, 255, 0.3)',
  },

  radius: {
    none: '0px',
    sm: '4px',
    md: '6px',
    full: '999px',
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontMono: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
}

// ============================================
// THEME MAP & HELPERS
// ============================================

export const themes = {
  cyberDark,
  softLight,
} as const

export type ThemeId = keyof typeof themes

export const getTheme = (id: ThemeId): Theme => themes[id]
