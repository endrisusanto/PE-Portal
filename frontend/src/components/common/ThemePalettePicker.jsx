import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './ThemePalettePicker.module.css';

export const ThemePalettePicker = () => {
  const {
    palette,
    setPalette,
    customAccent,
    setCustomAccent,
    presets,
    theme,
    animatedBg,
    toggleAnimatedBg,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        className={styles.paletteTrigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Customize decorative theme palette"
        title="Customize decorative theme palette"
      >
        <Palette size={16} />
      </button>

      {isOpen && (
        <div className={styles.popover} role="menu">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Decorative Theme</span>
            <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 600 }}>
              <Sparkles size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
              Personalize
            </span>
          </div>

          <div className={styles.presetList}>
            {presets.filter((p) => p.id !== 'custom').map((p) => {
              const activeColor = theme === 'dark' ? p.darkColor : p.color;
              const isSelected = palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.presetItem} ${isSelected ? styles.presetItemActive : ''}`}
                  onClick={() => {
                    setPalette(p.id);
                  }}
                >
                  <div className={styles.presetLeft}>
                    <span style={{ fontSize: '14px' }}>{p.icon}</span>
                    <span
                      className={styles.swatch}
                      style={{ backgroundColor: activeColor }}
                    />
                    <span className={styles.presetName}>{p.name}</span>
                  </div>
                  {isSelected && <Check size={14} color="var(--color-accent)" />}
                </button>
              );
            })}
          </div>

          <div className={styles.customSection}>
            <span className={styles.customLabel}>🎨 Custom Hex:</span>
            <div className={styles.colorPickerWrapper}>
              <input
                type="color"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                className={styles.colorInput}
                title="Choose your personal accent color"
              />
              <span className={styles.colorHex}>{customAccent.toUpperCase()}</span>
            </div>
          </div>

          <div className={styles.animatedBgSection}>
            <div className={styles.animatedBgLabel}>
              <Sparkles size={13} color="var(--color-accent)" />
              <span>Animated BG</span>
            </div>
            <button
              type="button"
              className={`${styles.toggleSwitch} ${animatedBg ? styles.toggleSwitchActive : ''}`}
              onClick={toggleAnimatedBg}
              aria-label="Toggle animated theme background"
              title={animatedBg ? "Disable animated background" : "Enable animated background"}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
