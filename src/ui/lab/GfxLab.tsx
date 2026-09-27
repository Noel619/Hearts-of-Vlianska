// Laboratorio de gráficos (abre la página con #lab): muestra todos los sprites
// procedurales para revisarlos de un vistazo.
import { useEffect, useRef, type ReactNode } from 'react';
import { FACTION_IDS } from '../../game/types';
import { emblemCanvas } from '../../gfx/emblems';
import { paintPortrait } from '../../gfx/portraits';
import { LEADERS } from '../../data';

function CanvasBox({ make, scale = 1, label }: { make: () => HTMLCanvasElement; scale?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = make();
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    ref.current?.replaceChildren(c);
  }, [make, scale]);
  return (
    <figure style={{ margin: 0, display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div ref={ref} />
      {label && <figcaption style={{ fontSize: 11, color: '#9a927f' }}>{label}</figcaption>}
    </figure>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 22, color: '#d7b36a', marginBottom: 10 }}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>{children}</div>
    </section>
  );
}

export function GfxLab() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, background: '#101311' }}>
      <Section title="Retratos">
        {Object.values(LEADERS).map((l) => (
          <CanvasBox key={l.id} make={() => paintPortrait(l.portrait, 2)} scale={0.5} label={l.name} />
        ))}
      </Section>
      <Section title="Emblemas">
        {[...FACTION_IDS, null].map((f) => (
          <CanvasBox key={f ?? 'none'} make={() => emblemCanvas(f, 160)} label={f ?? 'ninguna'} />
        ))}
        {FACTION_IDS.map((f) => (
          <CanvasBox key={`s${f}`} make={() => emblemCanvas(f, 48)} />
        ))}
      </Section>
    </div>
  );
}
