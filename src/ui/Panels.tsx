// Ventanas de interacción: conversación, comercio, registro y almacenes,
// peaje de los bandidos y recetas de taller.

import { useState } from 'react';
import { BUILDS, RECIPES } from '../data/edificios';
import { FACTION_LORE } from '../data/historia/facciones';
import { STATION_BY_ID } from '../data/historia/mapa';
import { ITEMS, type EquipSlot, type Stack } from '../data/items';
import type { FactionId } from '../data/tipos';
import type { Panel, Target } from '../game/game';
import { healCost, holderItems, owned, payHeal, recipeAvailable, setRecipe, transfer, type Holder } from '../sim/actions';
import { building } from '../sim/build';
import { addItem, countItem, invWeight, maxCarry } from '../sim/chars';
import { relation } from '../sim/combat';
import { buyItem, buyPrice, deliverLetter, deliverPrisoner, hire, payStaToll, sellItem, sellPrice, shopOf, staTollFee, staTollState } from '../sim/events';
import type { Char } from '../sim/types';
import { ItemIcon, Win, charTitle, itemTip, sideColor, sideName, useGame, useTick, useTooltip } from './core';

const GREET: Record<string, string[]> = {
  UNI: ['Orden y calma. Circule.', 'La Unión vela por estos túneles.', '¿Documentación? Bah, pase.'],
  SDR: ['Rusia vive en nosotros.', 'El este será ruso y ordenado.', 'Hable rápido.'],
  LEV: ['Salud, camarada.', 'Aquí nadie pasa hambre. ¿Puedes decir lo mismo de tu estación?', 'El Consejo decide; nosotros cumplimos.'],
  STA: ['Todo tiene un precio. También la paz.', 'Cinco túneles, cinco peajes. Bienvenido a la Encrucijada.', '¿Compras o vendes?'],
  VHL: ['¿Qué miras?', 'Aquí cada banda tiene sus reglas. Aprende rápido.', 'El Tuerto lo ve todo. Con un ojo.'],
  CHE: ['Estamos solos, arruinados y encerrados. Pero vivos.', 'La junta resiste.', 'No hemos olvidado el invierno de 2029.'],
  CAL: ['La paz sea contigo, forastero.', 'El hambre es nuestra prueba.', 'El agua de la Esmeralda es para todos.'],
  NOR: ['Bienvenido a la única democracia del metro.', '¿Vienes de abajo? Aquí se respira mejor.', 'Arriba hace frío. Aquí también.'],
  LIB: ['Malos tiempos para andar solo.', '¿Tienes algo de comer?', 'Voy de paso, como todos.'],
};

function rumor(c: Char, n: number): string {
  const f = FACTION_LORE[c.side as FactionId];
  const st = STATION_BY_ID[c.ai.place];
  const pool: string[] = [];
  if (f) pool.push(...f.lore);
  if (st) pool.push(st.desc);
  if (st?.feature) pool.push(`${st.feature.name}. ${st.feature.desc}`);
  pool.push(
    'Dicen que en Tenevskaya los almacenes de la defensa civil siguen intactos. Nadie que haya ido a comprobarlo ha vuelto con ganas de hablar.',
    'Bessmertny escribió a Volkov y la carta nunca llegó. En Tsentral\'naya, un funcionario de correos anda muy callado últimamente.',
    'El túnel sur lleva dos años sepultado. Quien lo reabra tendrá a Chernovodskaya comiendo de su mano… o apuntándole.',
    'En Mertvaya pagan la comida a precio de oro. El problema es cruzar las líneas del Levantamiento con el saco lleno.',
    'Los médicos de Nadezhdy compran glándulas de skrebun. No preguntes para qué.',
    'En el Terminal captaron una voz en la radio. Dicen que venía de Múrmansk.',
  );
  return pool[n % pool.length];
}

function DialogWin({ p }: { p: Extract<Panel, { t: 'hablar' }> }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const npc = sim.char(p.npc);
  const actor = sim.char(p.actor);
  const [text, setText] = useState<string | null>(null);
  const [n, setN] = useState(() => Math.floor(Math.random() * 100));
  if (!npc || !actor) return null;
  const close = () => g.closePanel();
  const greet = GREET[npc.side] ?? GREET.LIB;
  const rel = npc.side !== 'LIB' && npc.side !== 'JUG' && npc.side !== 'MUT' ? relation(sim, 'JUG', npc.side) : 10;
  const hasLetter = sim.players.some((q) => countItem(q, 'cartaBessmertny') > 0 && Math.hypot(q.x - npc.x, q.z - npc.z) < 20);
  const letterCarrier = sim.players.find((q) => countItem(q, 'cartaBessmertny') > 0) ?? actor;
  const prisoner = sim.players.map((q) => (q.carry ? sim.char(q.carry) : null)).find((q) => q?.unique === 'rybak' || q?.unique === 'baghdadi');
  const carrier = sim.players.find((q) => q.carry && sim.char(q.carry) === prisoner);
  const authority = npc.role === 'lider' || npc.role === 'oficial' || npc.role === 'elite' || !!npc.unique;
  const isDoc = npc.role === 'medico' || npc.vendor === 'medico';
  const cost = isDoc ? healCost(sim, actor) : 0;
  const say = (s: string | null) => s && setText(s);
  // En Staraya, quien no ha pagado el peaje no comercia
  const moroso = npc.side === 'STA' && npc.ai.place === 'STA' && staTollState(sim) === 'moroso';
  return (
    <Win title={npc.name} onClose={close} cls="dialog">
      <div className="row" style={{ marginBottom: 8 }}>
        <span style={{ width: 11, height: 11, background: sideColor(npc.side), border: '1px solid #000' }} />
        <span>{sideName(npc.side)}</span>
        <span className="dim">· {charTitle(npc)}</span>
      </div>
      {npc.bio && <p className="dim">{npc.bio}</p>}
      <p className="quote">{text ?? (rel < -20 ? 'No tengo nada que hablar contigo.' : `«${greet[(npc.id + n) % greet.length]}»`)}</p>
      <div className="opts">
        {npc.vendor && rel > -40 && !moroso && (
          <button
            className="btn"
            onClick={() => {
              g.panel = { t: 'comercio', npc: npc.id, actor: actor.id };
              g.bump();
            }}
          >
            Comerciar
          </button>
        )}
        {moroso && (
          <button className="btn" disabled={sim.state.money < staTollFee(sim)} onClick={() => say(payStaToll(sim) ?? '«Así sí. Bienvenidos a la Encrucijada.»')}>
            Pagar el peaje de Staraya ({staTollFee(sim)} cartuchos)
          </button>
        )}
        {isDoc && rel > -30 && (
          <button className="btn" disabled={cost <= 0} onClick={() => say(payHeal(sim, actor) ?? 'El médico trabaja en silencio. Cuando termina, tu gente vuelve a tenerse en pie.')}>
            {cost > 0 ? `Curar a mi gente (${cost} cartuchos)` : 'Nadie necesita cura'}
          </button>
        )}
        {npc.hire !== undefined && (
          <button
            className="btn"
            onClick={() => {
              const err = hire(sim, npc);
              if (err) say(err);
              else close();
            }}
          >
            Contratar ({npc.hire} cartuchos)
          </button>
        )}
        {hasLetter && npc.unique === 'volkov' && (
          <button className="btn" onClick={() => say(deliverLetter(sim, letterCarrier, 'volkov'))}>
            Entregar la carta de Bessmertny
          </button>
        )}
        {hasLetter && npc.unique === 'bessmertny' && (
          <button className="btn" onClick={() => say(deliverLetter(sim, letterCarrier, 'bessmertny'))}>
            Devolverle su carta: nunca llegó a Volkov
          </button>
        )}
        {hasLetter && npc.unique === 'orlova' && (
          <button className="btn" onClick={() => say(deliverLetter(sim, letterCarrier, 'orlova'))}>
            Vender la carta al Consejo Mercantil
          </button>
        )}
        {prisoner && carrier && authority && (
          <button className="btn" onClick={() => say(deliverPrisoner(sim, carrier, npc) ?? 'No es asunto mío.')}>
            Entregar a {prisoner.name}
          </button>
        )}
        {rel > -40 && (
          <button
            className="btn"
            onClick={() => {
              setN((v) => v + 1);
              setText(rumor(npc, n + npc.id));
            }}
          >
            ¿Qué se cuenta por aquí?
          </button>
        )}
        <button className="btn" onClick={close}>
          Adiós
        </button>
      </div>
    </Win>
  );
}

function TradeWin({ p }: { p: Extract<Panel, { t: 'comercio' }> }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const npc = sim.char(p.npc);
  const actor = sim.char(p.actor);
  const [msg, setMsg] = useState('');
  const tip = useTooltip();
  if (!npc || !actor) return null;
  const shop = shopOf(sim, npc);
  const place = npc.ai.place;
  const qty = (e: React.MouseEvent, n: number) => (e.ctrlKey ? n : e.shiftKey ? Math.min(5, n) : 1);
  return (
    <Win title={`Comercio · ${npc.name}`} onClose={() => g.closePanel()} width={860}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="amber">{npc.name}</b>
            <span className="sp" />
            <span className="dim">Tiene {shop.money} cartuchos</span>
          </div>
          <div className="list scroll" style={{ maxHeight: '54vh' }}>
            {shop.stock.map((s, i) => (
              <div
                key={i + s.id}
                className="item"
                {...tip.bind(itemTip(s))}
                onClick={(e) => {
                  setMsg(buyItem(sim, actor, npc, i, qty(e, s.n)) ?? '');
                  g.bump();
                }}
              >
                <ItemIcon id={s.id} />
                <span>{ITEMS[s.id].name}</span>
                <span className="q">×{s.n}</span>
                <span className="p">{buyPrice(sim, place, s.id, npc.side)}</span>
              </div>
            ))}
            {!shop.stock.length && <div className="dim">No le queda nada.</div>}
          </div>
        </div>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="amber">{actor.name}</b>
            <span className="sp" />
            <span className="dim">
              Tienes {sim.state.money} cartuchos · {invWeight(actor).toFixed(0)}/{maxCarry(actor).toFixed(0)} kg
            </span>
          </div>
          <div className="list scroll" style={{ maxHeight: '54vh' }}>
            {actor.inv.map((s, i) => (
              <div
                key={i + s.id}
                className="item"
                {...tip.bind(itemTip(s))}
                onClick={(e) => {
                  setMsg(sellItem(sim, actor, npc, i, qty(e, s.n)) ?? '');
                  g.bump();
                }}
              >
                <ItemIcon id={s.id} />
                <span>{ITEMS[s.id].name}</span>
                <span className="q">×{s.n}</span>
                <span className="p">{sellPrice(sim, place, s.id, npc.side)}</span>
              </div>
            ))}
            {!actor.inv.length && <div className="dim">No llevas nada que vender.</div>}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="dim">Clic: 1 unidad · Mayús: 5 · Ctrl: todas</span>
        <span className="sp" />
        <span className="bad">{msg}</span>
      </div>
      {tip.node}
    </Win>
  );
}

function holderFor(g: ReturnType<typeof useGame>, t: Target): { h: Holder; title: string; equip?: Char } | null {
  const sim = g.sim;
  if (t.kind === 'char') {
    const c = sim.char(t.id);
    return c ? { h: { kind: 'char', c }, title: c.name, equip: c.player ? undefined : c } : null;
  }
  if (t.kind === 'cont') {
    const c = sim.container(t.id);
    return c ? { h: { kind: 'cont', c }, title: c.label } : null;
  }
  if (t.kind === 'build') {
    const b = building(sim, t.id);
    return b ? { h: { kind: 'build', b }, title: BUILDS[b.def].name } : null;
  }
  return null;
}

function LootWin({ p }: { p: Extract<Panel, { t: 'saqueo' }> }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const actor = sim.char(p.actor);
  const tgt = holderFor(g, p.target);
  const [msg, setMsg] = useState('');
  const tip = useTooltip();
  if (!actor || !tgt) return null;
  const me: Holder = { kind: 'char', c: actor };
  // Si se aleja, se cierra
  if (Math.hypot(actor.x - p.target.x, actor.z - p.target.z) > 6) {
    queueMicrotask(() => g.closePanel());
    return null;
  }
  const items = holderItems(tgt.h);
  const qty = (e: React.MouseEvent, n: number) => (e.shiftKey ? 1 : n);
  const eq = tgt.equip;
  const takeEq = (slot: EquipSlot) => {
    if (!eq) return;
    const s = eq.eq[slot];
    if (!s) return;
    delete eq.eq[slot];
    addItem(eq, s.id, 1, { mag: s.mag });
    setMsg(transfer(sim, tgt.h, me, eq.inv.length - 1, 1, actor) ?? '');
    g.bump();
  };
  const all = () => {
    for (let i = items.length - 1; i >= 0; i--) transfer(sim, tgt.h, me, i, items[i].n, actor);
    g.bump();
  };
  const row = (s: Stack, i: number, from: Holder, to: Holder) => (
    <div
      key={i + s.id + (from === me ? 'a' : 'b')}
      className="item"
      {...tip.bind(itemTip(s))}
      onClick={(e) => {
        setMsg(transfer(sim, from, to, i, qty(e, s.n), actor) ?? '');
        tip.clear();
        g.bump();
      }}
    >
      <ItemIcon id={s.id} />
      <span>{ITEMS[s.id].name}</span>
      <span className="q">×{s.n}</span>
      <span className="p dim">{(ITEMS[s.id].w * s.n).toFixed(1)} kg</span>
    </div>
  );
  return (
    <Win title={tgt.title} onClose={() => g.closePanel()} width={820}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="amber">{tgt.title}</b>
            <span className="sp" />
            <button className="btn small" onClick={all} disabled={!items.length}>
              Coger todo
            </button>
          </div>
          <div className="list scroll" style={{ maxHeight: '52vh' }}>
            {eq &&
              (Object.keys(eq.eq) as EquipSlot[]).map((slot) => {
                const s = eq.eq[slot]!;
                return (
                  <div key={slot} className="item" {...tip.bind(itemTip(s))} onClick={() => takeEq(slot)}>
                    <ItemIcon id={s.id} />
                    <span>{ITEMS[s.id].name}</span>
                    <span className="q">puesto</span>
                    <span className="p dim">{ITEMS[s.id].w.toFixed(1)} kg</span>
                  </div>
                );
              })}
            {items.map((s, i) => row(s, i, tgt.h, me))}
            {!items.length && !(eq && Object.keys(eq.eq).length) && <div className="dim">Vacío.</div>}
          </div>
        </div>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="amber">{actor.name}</b>
            <span className="sp" />
            <span className="dim">
              {invWeight(actor).toFixed(0)}/{maxCarry(actor).toFixed(0)} kg
            </span>
          </div>
          <div className="list scroll" style={{ maxHeight: '52vh' }}>
            {actor.inv.map((s, i) => row(s, i, me, tgt.h))}
            {!actor.inv.length && <div className="dim">No llevas nada.</div>}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="dim">Clic: toda la pila · Mayús: una unidad</span>
        <span className="sp" />
        <span className="bad">{msg}</span>
      </div>
      {tip.node}
    </Win>
  );
}

function TollWin({ p }: { p: Extract<Panel, { t: 'peaje' }> }) {
  const g = useGame();
  const sim = g.sim;
  const npc = sim.char(p.npc);
  if (!npc) return null;
  if (npc.side === 'STA') {
    // Cinco túneles, cinco peajes
    const fee = staTollFee(sim);
    const union = sim.state.rep.UNI >= 40;
    return (
      <Win title="Peaje de Staraya" cls="dialog">
        <p className="quote">
          «Alto. Estáis en la Encrucijada: cinco túneles, cinco peajes. Son {fee} cartuchos por vuestra gente y lo que lleváis encima. Quien paga, comercia; quien no, media vuelta.»
        </p>
        <p className="dim">{npc.name}, del Consejo Mercantil, apunta algo en una libreta sin levantar la vista. Detrás, los mercenarios miran vuestras mochilas.</p>
        <div className="opts">
          <button
            className="btn"
            disabled={sim.state.money < fee}
            onClick={() => {
              payStaToll(sim);
              g.closePanel();
            }}
          >
            Pagar {fee} cartuchos
          </button>
          {union && (
            <button
              className="btn"
              onClick={() => {
                sim.state.flags.peajePagado = sim.day + 1;
                sim.log('Enseñas el salvoconducto de la Unión: por el Acuerdo de Libre Paso, sus caravanas no pagan en Staraya.', 'bueno');
                g.closePanel();
              }}
            >
              «Venimos con la Unión: libre paso.»
            </button>
          )}
          <button
            className="btn danger"
            onClick={() => {
              sim.rep('STA', -4, 'negarte a pagar el peaje');
              sim.log('No pagas el peaje. En Staraya nadie te venderá nada hasta que lo hagas.', 'malo');
              g.closePanel();
            }}
          >
            «Solo estamos de paso.»
          </button>
        </div>
      </Win>
    );
  }
  const toll = Math.max(20, Math.min(160, Math.round(sim.state.money * 0.25)));
  const sq = npc.squad ? sim.squad(npc.squad) : null;
  return (
    <Win title="Peaje de los bandidos" cls="dialog">
      <p className="quote">
        «Alto ahí. Estos túneles son de la Hermandad. {toll} cartuchos y seguís con todos los dientes. Pagar a Vhlainska es más barato que perder la caravana.»
      </p>
      <p className="dim">{npc.name} y los suyos os cierran el paso con las armas a medio levantar.</p>
      <div className="opts">
        <button
          className="btn"
          disabled={sim.state.money < toll}
          onClick={() => {
            sim.state.money -= toll;
            sim.rep('VHL', 2);
            sim.log(`Pagas ${toll} cartuchos de peaje a la Hermandad.`, 'info');
            g.closePanel();
          }}
        >
          Pagar {toll} cartuchos
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (sq) sq.angry = true;
            sim.log('Te niegas a pagar. Los saqueadores echan mano a las armas.', 'malo');
            g.closePanel();
          }}
        >
          «No pagamos a ladrones.»
        </button>
      </div>
    </Win>
  );
}

function WorkshopWin({ p }: { p: Extract<Panel, { t: 'taller' }> }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const b = building(sim, p.id);
  if (!b) return null;
  const def = BUILDS[b.def];
  const recipes = (def.recipes ?? []).map((id) => RECIPES[id]).filter(Boolean);
  return (
    <Win title={def.name} onClose={() => g.closePanel()} width={720}>
      <p className="dim" style={{ marginTop: 0 }}>
        Elige qué fabricar y asigna a alguien al taller (clic derecho sobre él). Los materiales se cogen del almacén más cercano.
      </p>
      <div className="list">
        {recipes.map((r) => {
          const ok = recipeAvailable(sim, r.id);
          const cur = b.recipe === r.id;
          return (
            <div key={r.id} className={'card' + (cur ? ' sel' : '') + (ok ? '' : ' off')} style={{ cursor: 'default' }}>
              <div className="row">
                <ItemIcon id={r.out[0]} />
                <h4 className="grow">
                  {r.name} <span className="dim">×{r.out[1]}</span>
                </h4>
                {ok ? (
                  <>
                    {[1, 5].map((n) => (
                      <button key={n} className="btn small" onClick={() => (setRecipe(sim, b, r.id, (cur ? b.count : 0) + n, false), g.bump())}>
                        +{n}
                      </button>
                    ))}
                    <button className={'btn small' + (cur && b.loop ? ' on' : '')} onClick={() => (setRecipe(sim, b, r.id, 0, !(cur && b.loop)), g.bump())}>
                      Sin parar
                    </button>
                  </>
                ) : (
                  <span className="bad">Falta investigar</span>
                )}
              </div>
              <div className="cost">
                {r.in.map(([id, n]) => (
                  <span key={id} className={owned(sim, id) + countItem({ inv: b.store }, id) >= n ? '' : 'no'}>
                    {n} × {ITEMS[id].name} ({owned(sim, id)})
                  </span>
                ))}
                {cur && <span className="amber">{b.loop ? 'En bucle' : `Pendientes: ${b.count}`} · {Math.round(b.craft * 100)} %</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => (setRecipe(sim, b, null, 0, false), g.bump())}>
          Parar
        </button>
        <span className="sp" />
        <button className="btn" onClick={() => g.openBuilding(b.id)}>
          Ver contenido
        </button>
      </div>
    </Win>
  );
}

export function PanelView() {
  const g = useGame();
  useTick();
  const p = g.panel;
  if (!p) return null;
  switch (p.t) {
    case 'hablar':
      return <DialogWin key={'h' + p.npc} p={p} />;
    case 'comercio':
      return <TradeWin p={p} />;
    case 'saqueo':
      return <LootWin p={p} />;
    case 'peaje':
      return <TollWin p={p} />;
    case 'taller':
      return <WorkshopWin p={p} />;
    default:
      return null;
  }
}
