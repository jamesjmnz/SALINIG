'use client';

import { useEffect } from 'react';
import { type TweakState } from '@/lib/consoleData';

interface ConsoleTweaksProps {
  tweaks: TweakState;
  setTweak: (key: keyof TweakState, value: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function ConsoleTweaks({ tweaks, setTweak, visible, onClose }: ConsoleTweaksProps) {
  const applyTheme = (t: string) => {
    document.body.classList.remove('theme-dark', 'theme-midnight');
    if (t === 'dark') document.body.classList.add('theme-dark');
    if (t === 'midnight') document.body.classList.add('theme-midnight');
  };
  const applyDensity = (d: string) => {
    document.body.classList.remove('density-compact', 'density-spacious');
    if (d === 'compact') document.body.classList.add('density-compact');
    if (d === 'spacious') document.body.classList.add('density-spacious');
  };
  const applyStyle = (s: string) => {
    document.body.classList.remove('style-clinical', 'style-editorial');
    if (s === 'clinical') document.body.classList.add('style-clinical');
    if (s === 'editorial') document.body.classList.add('style-editorial');
  };

  const set = (k: keyof TweakState, v: string) => {
    setTweak(k, v);
    if (k === 'theme') applyTheme(v);
    if (k === 'density') applyDensity(v);
    if (k === 'dataStyle') applyStyle(v);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  useEffect(() => {
    applyTheme(tweaks.theme);
    applyDensity(tweaks.density);
    applyStyle(tweaks.dataStyle);
  }, []);

  return (
    <div className={`tweaks-float ${visible ? '' : 'hidden'}`}>
      <div className="tweaks-float-head">
        <span className="tweaks-float-title">Tweaks</span>
        <button className="tweaks-close" onClick={onClose}>×</button>
      </div>
      <div className="tweaks-body">

        {/* Theme */}
        <div className="tweak-group">
          <div className="tweak-group-label">Theme</div>
          <div className="tweak-swatches">
            {[
              { id: 'light',    label: 'Light',    cls: 'swatch-light' },
              { id: 'dark',     label: 'Dark',     cls: 'swatch-dark' },
              { id: 'midnight', label: 'Midnight', cls: 'swatch-midnight' },
            ].map(s => (
              <div key={s.id} className={`tweak-swatch ${s.cls} ${tweaks.theme === s.id ? 'selected' : ''}`}
                onClick={() => set('theme', s.id)}>
                <span className="tweak-swatch-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Density */}
        <div className="tweak-group">
          <div className="tweak-group-label">Density</div>
          <div className="tweak-seg">
            {['compact', 'default', 'spacious'].map(d => (
              <button key={d} className={`tweak-seg-btn ${tweaks.density === d ? 'active' : ''}`}
                onClick={() => set('density', d)}>{d}</button>
            ))}
          </div>
        </div>

        {/* Data Style */}
        <div className="tweak-group">
          <div className="tweak-group-label">Data Style</div>
          <div className="tweak-style-cards">
            {[
              { id: 'clinical',    preview: '01', previewCls: 'mono',  label: 'Clinical' },
              { id: 'operational', preview: '87', previewCls: '',      label: 'Operat.' },
              { id: 'editorial',   preview: '87', previewCls: 'serif', label: 'Editorial' },
            ].map(s => (
              <div key={s.id} className={`tweak-style-card ${tweaks.dataStyle === s.id ? 'active' : ''}`}
                onClick={() => set('dataStyle', s.id)}>
                <div className={`tweak-style-preview ${s.previewCls}`}>{s.preview}</div>
                <div className="tweak-style-name">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
