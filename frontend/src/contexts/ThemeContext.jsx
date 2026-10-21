import React, { createContext, useContext, useState, useEffect } from 'react';

export const PALETTE_PRESETS = [
  { id: 'corporate', name: 'SEIN Corporate Teal', icon: '🏢', color: '#0d7377', darkColor: '#4db8b5', desc: 'Industrial engineering standard' },
  { id: 'cute', name: 'Sakura Mochi (Cute)', icon: '🌸', color: '#e05780', darkColor: '#ff7597', desc: 'Soft pastel pink & cheerful mochi tone' },
  { id: 'cyberpunk', name: 'Neon Emerald', icon: '⚡', color: '#059669', darkColor: '#10b981', desc: 'High-contrast matrix & hacker green' },
  { id: 'cobalt', name: 'Galactic Cobalt', icon: '🌌', color: '#2563eb', darkColor: '#60a5fa', desc: 'Executive Samsung corporate blue' },
  { id: 'amber', name: 'Sunset Amber', icon: '🌅', color: '#d97706', darkColor: '#fbbf24', desc: 'Warm engineering workshop glow' },
  { id: 'purple', name: 'Cyber Lavender', icon: '🔮', color: '#7c3aed', darkColor: '#a78bfa', desc: 'Futuristic electric violet' },
  { id: 'custom', name: 'Custom Personal Color', icon: '🎨', color: '#ec4899', darkColor: '#f472b6', desc: 'Pick your own favorite hex accent' },
];

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pe_portal_theme') || 'light';
  });

  const [palette, setPalette] = useState(() => {
    return localStorage.getItem('pe_portal_palette') || 'corporate';
  });

  const [customAccent, setCustomAccent] = useState(() => {
    return localStorage.getItem('pe_portal_custom_accent') || '#e05780';
  });

  // Animated background toggle state (default true)
  const [animatedBg, setAnimatedBgState] = useState(() => {
    const saved = localStorage.getItem('pe_portal_animated_bg');
    return saved !== null ? saved === 'true' : true;
  });

  // Sync theme mode (light / dark)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pe_portal_theme', theme);
  }, [theme]);

  // Sync decorative palette & custom color
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('pe_portal_palette', palette);

    if (palette === 'custom') {
      document.documentElement.style.setProperty('--color-accent', customAccent);
      document.documentElement.style.setProperty('--color-accent-hover', customAccent);
      document.documentElement.style.setProperty('--color-accent-subtle', `${customAccent}22`);
      localStorage.setItem('pe_portal_custom_accent', customAccent);
    } else {
      document.documentElement.style.removeProperty('--color-accent');
      document.documentElement.style.removeProperty('--color-accent-hover');
      document.documentElement.style.removeProperty('--color-accent-subtle');
    }
  }, [palette, customAccent, theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const changePalette = (newPalette) => {
    setPalette(newPalette);
  };

  const updateCustomAccent = (hex) => {
    setCustomAccent(hex);
    setPalette('custom');
  };

  const toggleAnimatedBg = () => {
    setAnimatedBgState((prev) => {
      const next = !prev;
      localStorage.setItem('pe_portal_animated_bg', String(next));
      return next;
    });
  };

  const setAnimatedBg = (enabled) => {
    setAnimatedBgState(enabled);
    localStorage.setItem('pe_portal_animated_bg', String(enabled));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        palette,
        setPalette: changePalette,
        customAccent,
        setCustomAccent: updateCustomAccent,
        animatedBg,
        setAnimatedBg,
        toggleAnimatedBg,
        presets: PALETTE_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
