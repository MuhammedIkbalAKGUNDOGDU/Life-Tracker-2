import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Minus, Trash2, Copy, Dumbbell, Flame, X, Search, Trophy,
  TrendingUp, Scale, RotateCcw, Sparkles, History, Pencil, Timer
} from 'lucide-react';
import NumInput from './NumInput';
import ModalShell from './ModalShell';
import { LineChart, BarChart } from './HealthCharts';
import { confirmDialog, notify } from '../ui';
import { api, todayStr, addDays, niceDate, shortDate, fmtNum, epley } from '../healthApi';

const TITLE_CHIPS = ['Push', 'Pull', 'Bacak', 'Üst vücut', 'Alt vücut', 'Full body'];
const MUSCLES = ['Göğüs', 'Sırt', 'Omuz', 'Kol', 'Bacak', 'Karın'];

// "80×8 ×2, 75×10" (identical consecutive sets grouped, warm-ups marked with a flame)
const formatSetsText = (sets) => {
  const out = [];
  for (const s of sets) {
    const key = `${s.weight}×${s.reps}`;
    const prev = out[out.length - 1];
    if (prev && prev.key === key && prev.warm === s.is_warmup) prev.n += 1;
    else out.push({ key, n: 1, warm: s.is_warmup });
  }
  return out.map(o => `${o.warm ? '🔥' : ''}${o.key}${o.n > 1 ? ` ×${o.n}` : ''}`).join(', ');
};

// ---------- small pieces ----------

function Stepper({ value, onChange, step = 1, min = 0, label, big = false }) {
  const bump = (d) => onChange(Math.max(min, Math.round((value + d) * 100) / 100));
  return (
    <div className={`stepper ${big ? 'big' : ''}`}>
      {label && <span className="stepper-label">{label}</span>}
      <div className="stepper-row">
        <button type="button" onClick={() => bump(-step)} aria-label={`${label || ''} azalt`}><Minus size={18} /></button>
        <NumInput value={value} onChange={onChange} min={min} inputMode="decimal" />
        <button type="button" onClick={() => bump(step)} aria-label={`${label || ''} artır`}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function SetRow({ set, index, onUpdate, onDelete }) {
  const [weight, setWeight] = useState(set.weight);
  const [reps, setReps] = useState(set.reps);
  const [rpe, setRpe] = useState(set.rpe ?? '');

  // Save when leaving the row's fields, only if something changed
  const commit = () => {
    const patch = {};
    if (weight !== set.weight) patch.weight = weight;
    if (reps !== set.reps) patch.reps = reps;
    if ((rpe === '' ? null : Number(rpe)) !== set.rpe) patch.rpe = rpe === '' ? null : Number(rpe);
    if (Object.keys(patch).length) onUpdate(set.id, patch);
  };

  return (
    <div
      className={`set-row ${set.is_warmup ? 'warm' : ''}`}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commit(); }}
    >
      <button
        type="button"
        className="set-num"
        onClick={() => onUpdate(set.id, { is_warmup: !set.is_warmup })}
        title={set.is_warmup ? 'Isınma seti (hacme dahil değil). Normal yapmak için dokun' : 'Isınma seti yapmak için dokun'}
      >
        {set.is_warmup ? <Flame size={14} /> : index + 1}
      </button>
      <label className="set-field"><NumInput value={weight} onChange={setWeight} min={0} inputMode="decimal" aria-label="Ağırlık" /><small>kg</small></label>
      <span className="set-x">×</span>
      <label className="set-field"><NumInput value={reps} onChange={setReps} min={0} integer inputMode="numeric" aria-label="Tekrar" /><small>tekrar</small></label>
      <select className="set-rpe" value={rpe} onChange={(e) => { setRpe(e.target.value); onUpdate(set.id, { rpe: e.target.value === '' ? null : Number(e.target.value) }); }} title="Zorluk (RPE)">
        <option value="">RPE</option>
        {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <button type="button" className="icon-btn" onClick={() => onDelete(set.id)} aria-label="Seti sil"><X size={16} /></button>
    </div>
  );
}

function ExerciseBlock({ ex, info, onAddSet, onUpdateSet, onDeleteSet, onRemove }) {
  const lastSession = info?.history?.[0];
  const lastToday = ex.sets[ex.sets.length - 1];
  const lastWork = lastSession ? [...lastSession.sets].reverse().find(s => !s.is_warmup) : null;
  const [weight, setWeight] = useState(lastToday?.weight ?? lastWork?.weight ?? 20);
  const [reps, setReps] = useState(lastToday?.reps ?? lastWork?.reps ?? 8);
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // History loads after the card is first drawn: fill the inputs with last time's numbers once it arrives
  useEffect(() => {
    if (seeded.current || !info) return;
    seeded.current = true;
    if (lastToday || !lastWork) return;
    setWeight(lastWork.weight);
    setReps(lastWork.reps);
  }, [info, lastToday, lastWork]);

  const add = async (w = weight, r = reps, warm = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await onAddSet(ex, { weight: w, reps: r, is_warmup: warm });
    } finally {
      setBusy(false);
    }
  };

  const copyLast = async () => {
    for (const s of lastSession.sets) await onAddSet(ex, { weight: s.weight, reps: s.reps, is_warmup: s.is_warmup, rpe: s.rpe }, true);
    notify('Geçen seferin setleri eklendi.', 'success');
  };

  const sug = info?.suggestion;
  const work = ex.sets.filter(s => !s.is_warmup);
  const volume = Math.round(work.reduce((a, s) => a + s.weight * s.reps, 0));

  return (
    <section className="ex-block glass-card">
      <header className="ex-head">
        <div>
          <h4>{ex.name}</h4>
          <small>{ex.muscle || 'Hareket'}{work.length ? ` · ${work.length} set · ${fmtNum(volume, 0)} kg hacim` : ''}</small>
        </div>
        <button type="button" className="icon-btn" onClick={() => onRemove(ex)} aria-label="Hareketi kaldır"><Trash2 size={17} /></button>
      </header>

      {lastSession ? (
        <div className="ex-last-list">
          <div className="ex-last"><History size={14} /><span><b>Geçen sefer ({shortDate(lastSession.date)}):</b> {info.format(lastSession.sets)}</span>
            {ex.sets.length === 0 && <button type="button" className="chip-btn" onClick={copyLast}><Copy size={13} /> Aynen kopyala</button>}
          </div>
          {info.history.slice(1, 3).map(h => (
            <div key={h.we_id} className="ex-last older"><span><b>{shortDate(h.date)}:</b> {info.format(h.sets)}</span></div>
          ))}
        </div>
      ) : (
        <div className="ex-last muted">Bu hareketi ilk kez yapıyorsun, setlerini gir, bir sonraki sefer burada görünür.</div>
      )}
      {sug && (
        <button type="button" className="ex-suggest" onClick={() => { setWeight(sug.weight); setReps(sug.reps); }}>
          <Sparkles size={14} /> Öneri: <b>{sug.weight} kg × {sug.reps}</b>
          <small>{sug.reason}</small>
        </button>
      )}

      <div className="sets">
        {ex.sets.map((s, i) => (
          <SetRow key={`${s.id}-${s.weight}-${s.reps}-${s.is_warmup}`} set={s} index={i - ex.sets.slice(0, i).filter(x => x.is_warmup).length} onUpdate={onUpdateSet} onDelete={onDeleteSet} />
        ))}
      </div>

      <div className="add-set">
        <Stepper label="Ağırlık (kg)" value={weight} onChange={setWeight} step={2.5} />
        <Stepper label="Tekrar" value={reps} onChange={setReps} step={1} />
        <div className="add-set-actions">
          <button type="button" className="btn btn-primary add-set-btn" onClick={() => add()} disabled={busy}>
            <Plus size={18} /> Set ekle
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => add(weight, reps, true)} disabled={busy} title="Isınma seti olarak ekle">
            <Flame size={16} /> Isınma
          </button>
        </div>
      </div>
    </section>
  );
}

function ExercisePicker({ exercises, recent, suggestedIds, onPick, onCreate, onClose, onChanged, usedIds }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [open, setOpen] = useState(null); // exercise id whose last sessions are expanded
  const [manage, setManage] = useState(false); // edit / delete exercises
  const [editing, setEditing] = useState(null); // { id, name, muscle, aliases }
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
  const list = exercises.filter(e => {
    if (muscle && e.muscle !== muscle) return false;
    if (!q.trim()) return true;
    const hay = norm(`${e.name} ${(e.aliases || []).join(' ')}`);
    return norm(q).split(/\s+/).every(w => hay.includes(w));
  });
  const exact = exercises.some(e => norm(e.name) === norm(q.trim()));

  const saveEdit = async () => {
    try {
      await api('PUT', `/api/health/exercises/${editing.id}`, { name: editing.name, muscle: editing.muscle, aliases: editing.aliases });
      setEditing(null);
      notify('Hareket güncellendi.', 'success');
      onChanged();
    } catch { /* toast shown */ }
  };
  const removeExercise = async (e) => {
    const ok = await confirmDialog({
      title: 'Hareket silinsin mi?',
      message: e.uses ? `"${e.name}" hareketi ve ${e.uses} antrenmandaki tüm setleri silinecek.` : `"${e.name}" hareketi listeden kaldırılacak.`,
      confirmText: 'Sil',
      danger: true
    });
    if (!ok) return;
    try {
      await api('DELETE', `/api/health/exercises/${e.id}`);
      onChanged();
    } catch { /* toast shown */ }
  };
  // Smart order: while typing, names that start with the text first; otherwise the
  // exercises of the earlier same-named workout, then most recently used.
  const nq = norm(q.trim());
  const rank = (e) => {
    if (nq) return norm(e.name).startsWith(nq) ? 0 : (e.aliases || []).some(a => norm(a).startsWith(nq)) ? 1 : 2;
    return suggestedIds.includes(e.id) ? 0 : 1;
  };
  list.sort((a, b) => rank(a) - rank(b)); // stable: keeps "most recent first" within a group

  return (
    <ModalShell onClose={onClose} className="sheet" style={{ maxWidth: '520px' }}>
      <div className="modal-header">
        <h2>{manage ? 'Hareketleri yönet' : 'Hareket ekle'}</h2>
        <button type="button" className={`icon-btn ${manage ? 'active' : ''}`} onClick={() => { setManage(m => !m); setEditing(null); }} aria-label="Hareketleri düzenle" title="Hareketleri yeniden adlandır / sil"><Pencil size={18} /></button>
        <button className="btn-close" data-modal-close type="button"><X /></button>
      </div>
      <div className="picker">
        <div className="picker-search"><Search size={16} /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hareket ara… (bench, squat, barfiks)" /></div>
        <div className="chip-row">
          <button type="button" className={`chip ${muscle === '' ? 'on' : ''}`} onClick={() => setMuscle('')}>Hepsi</button>
          {MUSCLES.map(m => <button type="button" key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(m)}>{m}</button>)}
        </div>
        <div className="picker-list">
          {manage && list.map(e => (
            <div key={e.id} className="picker-item manage-row">
              {editing?.id === e.id ? (
                <form className="manage-form" onSubmit={async (ev) => { ev.preventDefault(); await saveEdit(); }}>
                  <input value={editing.name} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} placeholder="Hareket adı" autoFocus />
                  <select value={editing.muscle} onChange={(ev) => setEditing({ ...editing, muscle: ev.target.value })}>
                    <option value="">Kas grubu yok</option>
                    {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={editing.aliases} onChange={(ev) => setEditing({ ...editing, aliases: ev.target.value })} placeholder="Takma adlar (virgülle: bench, benç)" />
                  <div className="manage-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Vazgeç</button>
                    <button type="submit" className="btn btn-primary">Kaydet</button>
                  </div>
                </form>
              ) : (
                <>
                  <span><b>{e.name}</b><small>{e.muscle || 'Kas grubu yok'}{e.uses ? ` · ${e.uses} antrenmanda` : ''}{(e.aliases || []).length ? ` · ${e.aliases.join(', ')}` : ''}</small></span>
                  <span className="manage-btns">
                    <button type="button" className="icon-btn" onClick={() => setEditing({ id: e.id, name: e.name, muscle: e.muscle || '', aliases: (e.aliases || []).join(', ') })} aria-label={`${e.name} düzenle`}><Pencil size={16} /></button>
                    <button type="button" className="icon-btn" onClick={() => removeExercise(e)} aria-label={`${e.name} sil`}><Trash2 size={16} /></button>
                  </span>
                </>
              )}
            </div>
          ))}
          {!manage && list.map(e => {
            const sessions = recent[e.id] || [];
            const used = usedIds.includes(e.id);
            const expanded = open === e.id;
            const isSuggested = !nq && suggestedIds.includes(e.id);
            return (
              <div key={e.id} className={`picker-item ex-pick ${expanded ? 'open' : ''}`}>
                <button type="button" className="picker-main" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded}>
                  <span>
                    <b>{e.name}</b>
                    <small>{isSuggested ? '★ geçen antrenmanda vardı · ' : ''}{e.muscle}{sessions[0] ? ` · son (${shortDate(sessions[0].date)}): ${formatSetsText(sessions[0].sets.filter(x => !x.is_warmup))}` : ' · henüz yapılmadı'}</small>
                  </span>
                </button>
                {used ? <small>eklendi</small> : (
                  <button type="button" className="icon-btn add" onClick={() => onPick(e)} aria-label={`${e.name} ekle`}><Plus size={20} /></button>
                )}
                {expanded && (
                  <div className="ex-pick-detail">
                    {sessions.length === 0 ? <p className="muted small">Bu hareketi daha önce yapmadın.</p> : sessions.map(h => (
                      <div key={h.date}><b>{shortDate(h.date)}</b><span>{formatSetsText(h.sets.filter(x => !x.is_warmup))}</span></div>
                    ))}
                    {!used && <button type="button" className="btn btn-primary" onClick={() => onPick(e)}><Plus size={16} /> Antrenmana ekle</button>}
                  </div>
                )}
              </div>
            );
          })}
          {!manage && q.trim() && !exact && (
            <button type="button" className="picker-item create" onClick={() => onCreate(q.trim(), muscle)}>
              <span><b>“{q.trim()}” hareketini oluştur</b><small>{muscle || 'Kas grubu seçmek için yukarıdan filtre seç'}</small></span>
              <Plus size={18} />
            </button>
          )}
          {list.length === 0 && !q.trim() && <p className="muted">Hareket yok.</p>}
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- rest timer ----------

const REST_CHOICES = [60, 90, 120, 180];

function RestTimer({ endAt, onSkip, onAdd }) {
  const [now, setNow] = useState(Date.now());
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endAt]);

  const left = Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !done.current) {
      done.current = true;
      try { navigator.vibrate?.([250, 120, 250]); } catch { /* not supported */ }
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.08;
        o.start(); o.stop(ctx.currentTime + 0.35);
      } catch { /* audio blocked */ }
    }
  }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(1, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className={`rest-timer ${left === 0 ? 'done' : ''}`} role="timer" aria-live="off">
      <Timer size={18} />
      <b>{left === 0 ? 'Dinlenme bitti, sıradaki set!' : `${mm}:${ss}`}</b>
      {left > 0 && <button type="button" onClick={() => onAdd(15)}>+15 sn</button>}
      <button type="button" onClick={onSkip}>{left === 0 ? 'Tamam' : 'Atla'}</button>
    </div>
  );
}

// ---------- session detail ----------

function WorkoutDetailModal({ workout, onClose, onGo, onCopy }) {
  const work = (sets) => sets.filter(s => !s.is_warmup);
  const vol = (sets) => Math.round(work(sets).reduce((a, s) => a + s.weight * s.reps, 0));
  const total = workout.exercises.reduce((a, e) => a + vol(e.sets), 0);
  const totalSets = workout.exercises.reduce((a, e) => a + work(e.sets).length, 0);
  return (
    <ModalShell onClose={onClose} className="sheet" style={{ maxWidth: '560px' }}>
      <div className="modal-header">
        <div>
          <h2>{workout.title || 'Antrenman'}</h2>
          <small className="muted">{niceDate(workout.workout_date)} · {workout.exercises.length} hareket · {totalSets} set · {fmtNum(total, 0)} kg hacim</small>
        </div>
        <button className="btn-close" data-modal-close type="button"><X /></button>
      </div>
      <div className="picker detail">
        {workout.exercises.map(e => {
          const best = work(e.sets).reduce((b, s) => (epley(s.weight, s.reps) > epley(b.weight, b.reps) ? s : b), work(e.sets)[0] || { weight: 0, reps: 0 });
          return (
            <section key={e.id} className="detail-ex">
              <header>
                <b>{e.name}</b>
                <small>{work(e.sets).length} set · {fmtNum(vol(e.sets), 0)} kg{best.weight ? ` · 1RM ≈ ${fmtNum(epley(best.weight, best.reps))} kg` : ''}</small>
              </header>
              {e.sets.map((s, i) => (
                <div key={s.id} className={`detail-set ${s.is_warmup ? 'warm' : ''}`}>
                  <span className="set-num small-num">{s.is_warmup ? <Flame size={12} /> : i + 1 - e.sets.slice(0, i).filter(x => x.is_warmup).length}</span>
                  <b>{fmtNum(s.weight)} kg × {s.reps}</b>
                  {s.rpe ? <small>RPE {s.rpe}</small> : <small />}
                </div>
              ))}
            </section>
          );
        })}
        {workout.notes && workout.notes !== '[MOCK]' && <p className="muted small">{workout.notes}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => onCopy(workout)}><Copy size={15} /> Bugüne kopyala</button>
          <button type="button" className="btn btn-primary" onClick={() => onGo(workout.workout_date)}>Bu güne git / düzenle</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- progress ----------

function ProgressPanel({ exercises, onOpenWorkout }) {
  const used = exercises.filter(e => e.uses > 0);
  const [id, setId] = useState('');
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!id && used[0]) setId(String(used[0].id));
  }, [used, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([api('GET', `/api/health/exercises/${id}/stats`), api('GET', `/api/health/exercises/${id}/history?limit=8`)])
      .then(([s, h]) => { if (!cancelled) { setStats(s); setHistory(h.history); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  if (used.length === 0) {
    return <div className="glass-card health-card"><h3><TrendingUp size={18} /> İlerleme</h3><p className="muted">İlk antrenmanını kaydedince hareket bazlı grafikler burada görünecek.</p></div>;
  }
  const pts = stats?.points || [];
  const last = pts.slice(-12);
  return (
    <div className="glass-card health-card">
      <div className="health-card-head">
        <h3><TrendingUp size={18} /> İlerleme</h3>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {used.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {stats && (
        <>
          <div className="pr-row">
            <div><Trophy size={16} /><span>En ağır</span><b>{stats.prWeight ? `${fmtNum(stats.prWeight.maxWeight)} kg` : '—'}</b><small>{stats.prWeight ? shortDate(stats.prWeight.date) : ''}</small></div>
            <div><TrendingUp size={16} /><span>Tahmini 1RM</span><b>{stats.prE1rm ? `${fmtNum(stats.prE1rm.e1rm)} kg` : '—'}</b><small>{stats.prE1rm ? shortDate(stats.prE1rm.date) : ''}</small></div>
          </div>
          <LineChart
            unit=" kg"
            series={[
              { label: 'Tahmini 1RM', color: '#6366f1', points: last.map(p => ({ x: shortDate(p.date), y: p.e1rm })) },
              { label: 'En ağır set', color: '#10b981', points: last.map(p => ({ x: shortDate(p.date), y: p.maxWeight })) }
            ]}
          />
          <div className="legend"><span><i style={{ background: '#6366f1' }} /> Tahmini 1RM</span><span><i style={{ background: '#10b981' }} /> En ağır set</span></div>
          <h4 className="sub-h">Antrenman hacmi (kg)</h4>
          <BarChart bars={last.map(p => ({ label: shortDate(p.date), value: p.volume }))} />
          <h4 className="sub-h">Son seanslar</h4>
          <div className="hist-list">
            {history.map(h => (
              <button type="button" key={h.we_id} onClick={() => onOpenWorkout(h.date, h.workout_id)} title="Bu antrenmanın tamamını aç">
                <b>{shortDate(h.date)}</b><span>{h.sets.map(s => `${s.weight}×${s.reps}`).join(', ')}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BodyWeightCard() {
  const [rows, setRows] = useState([]);
  const [value, setValue] = useState(0);
  const load = useCallback(() => api('GET', '/api/health/body-weights').then(setRows).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (rows[0] && value === 0) setValue(rows[0].weight); }, [rows, value]);

  const save = async () => {
    if (!(value > 0)) return notify('Geçerli bir kilo girin.', 'error');
    await api('POST', '/api/health/body-weights', { weight: value, log_date: todayStr() });
    notify('Kilo kaydedildi.', 'success');
    load();
  };
  const pts = [...rows].reverse().slice(-30);
  const diff = rows.length > 1 ? rows[0].weight - rows[rows.length - 1].weight : 0;

  return (
    <div className="glass-card health-card">
      <div className="health-card-head"><h3><Scale size={18} /> Vücut kilosu</h3>{rows[0] && <small className="muted">Son: {fmtNum(rows[0].weight)} kg · {shortDate(rows[0].log_date)}</small>}</div>
      <div className="bw-row">
        <Stepper value={value} onChange={setValue} step={0.1} label="Bugünkü kilo (kg)" />
        <button type="button" className="btn btn-primary" onClick={save}>Kaydet</button>
      </div>
      {pts.length > 1 && (
        <>
          <LineChart unit=" kg" series={[{ label: 'Kilo', color: '#f59e0b', points: pts.map(p => ({ x: shortDate(p.log_date), y: p.weight })) }]} height={150} />
          <small className="muted">İlk kayıttan bu yana {diff > 0 ? '+' : '−'}{fmtNum(Math.abs(diff))} kg</small>
        </>
      )}
    </div>
  );
}

// ---------- main view ----------

export default function WorkoutView() {
  const [date, setDate] = useState(todayStr());
  const [workouts, setWorkouts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [infos, setInfos] = useState({}); // exerciseId -> { history, suggestion, pr }
  const [recent, setRecent] = useState([]);
  const [summary, setSummary] = useState([]);
  const [pickerFor, setPickerFor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [recentSessions, setRecentSessions] = useState({});
  const [restEndAt, setRestEndAt] = useState(0);
  const [restSeconds, setRestSeconds] = useState(() => {
    try { const v = parseInt(localStorage.getItem('rest_seconds'), 10); return Number.isFinite(v) ? v : 90; } catch { return 90; }
  }); // 0 = timer off
  const chooseRest = (v) => {
    setRestSeconds(v);
    try { localStorage.setItem('rest_seconds', String(v)); } catch { /* private mode */ }
    if (v === 0) setRestEndAt(0);
  };
  const [loading, setLoading] = useState(true);

  const formatSets = useMemo(() => (sets) => {
    const out = [];
    for (const s of sets) {
      const key = `${s.weight}×${s.reps}`;
      const prev = out[out.length - 1];
      if (prev && prev.key === key && prev.warm === s.is_warmup) prev.n += 1;
      else out.push({ key, n: 1, warm: s.is_warmup });
    }
    return out.map(o => `${o.warm ? '🔥' : ''}${o.key}${o.n > 1 ? ` ×${o.n}` : ''}`).join(', ');
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [w, ex, rec, sum, rs] = await Promise.all([
        api('GET', `/api/health/workouts?from=${date}&to=${date}`),
        api('GET', '/api/health/exercises'),
        api('GET', '/api/health/workouts?limit=60'),
        api('GET', '/api/health/summary'),
        api('GET', `/api/health/exercises/recent?limit=3&before=${date}`)
      ]);
      setRecentSessions(rs);
      setWorkouts(w);
      setExercises(ex);
      setRecent(rec);
      setSummary(sum);
    } catch { /* toast already shown */ }
    setLoading(false);
  }, [date]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // History + PR info for every exercise in the shown workouts
  const exerciseIds = useMemo(() => [...new Set(workouts.flatMap(w => w.exercises.map(e => e.exercise_id)))], [workouts]);
  useEffect(() => {
    exerciseIds.filter(id => !infos[id]).forEach(async (id) => {
      try {
        const [h, s] = await Promise.all([
          api('GET', `/api/health/exercises/${id}/history?limit=3&before=${date}`),
          api('GET', `/api/health/exercises/${id}/stats`)
        ]);
        setInfos(prev => ({ ...prev, [id]: { history: h.history, suggestion: h.suggestion, pr: s.prE1rm?.e1rm || 0, format: formatSets } }));
      } catch { /* ignore */ }
    });
  }, [exerciseIds, infos, date, formatSets]);
  // Date change makes "previous sessions" different
  useEffect(() => { setInfos({}); }, [date]);

  const replaceWorkout = (w) => setWorkouts(prev => (prev.some(x => x.id === w.id) ? prev.map(x => (x.id === w.id ? w : x)) : [w, ...prev]));

  const startWorkout = async (title = '') => {
    let w = await api('POST', '/api/health/workouts', { workout_date: date, title });
    const prev = sameTitle(title);
    if (prev) {
      // Same name as before: start with the same exercises (sets stay empty)
      w = await api('POST', `/api/health/workouts/${w.id}/import`, { from_id: prev.id });
      notify(`Geçen "${prev.title}" antrenmanından ${prev.exercises.length} hareket getirildi.`, 'success');
    }
    replaceWorkout(w);
    if (!prev) setPickerFor(w.id);
  };
  // Closing the picker on a brand-new, unnamed, empty workout removes it (no leftover empty cards)
  const closePicker = async () => {
    const w = workouts.find(x => x.id === pickerFor);
    setPickerFor(null);
    if (w && w.exercises.length === 0 && !w.title) {
      try {
        await api('DELETE', `/api/health/workouts/${w.id}`);
        setWorkouts(prev => prev.filter(x => x.id !== w.id));
      } catch { /* leave it */ }
    }
  };
  const importFrom = async (w, prev) => {
    replaceWorkout(await api('POST', `/api/health/workouts/${w.id}/import`, { from_id: prev.id }));
    notify(`${prev.exercises.length} hareket getirildi.`, 'success');
  };
  const copyWorkout = async (srcId) => {
    const w = await api('POST', `/api/health/workouts/${srcId}/copy`, { date, with_sets: false });
    replaceWorkout(w);
    notify('Antrenman kopyalandı. Setleri bugünkü değerlerle doldur.', 'success');
    loadAll();
  };
  const renameWorkout = async (w, title) => {
    if (title === w.title) return;
    replaceWorkout(await api('PUT', `/api/health/workouts/${w.id}`, { title }));
  };
  const deleteWorkout = async (w) => {
    const ok = await confirmDialog({ title: 'Antrenman silinsin mi?', message: 'Bu antrenman ve tüm setleri silinecek.', confirmText: 'Sil', danger: true });
    if (!ok) return;
    await api('DELETE', `/api/health/workouts/${w.id}`);
    setWorkouts(prev => prev.filter(x => x.id !== w.id));
    loadAll();
  };

  const addExercise = async (workoutId, payload) => {
    const w = await api('POST', `/api/health/workouts/${workoutId}/exercises`, payload);
    replaceWorkout(w);
    setPickerFor(null);
    api('GET', '/api/health/exercises').then(setExercises).catch(() => {});
  };
  const removeExercise = async (ex) => {
    const ok = await confirmDialog({ title: 'Hareket kaldırılsın mı?', message: `${ex.name} ve bu antrenmandaki setleri silinecek.`, confirmText: 'Kaldır', danger: true });
    if (!ok) return;
    const w = await api('DELETE', `/api/health/workout-exercises/${ex.id}`);
    if (w.id) replaceWorkout(w);
  };
  const addSet = async (ex, set, quiet = false) => {
    const w = await api('POST', `/api/health/workout-exercises/${ex.id}/sets`, set);
    replaceWorkout(w);
    if (!quiet && !set.is_warmup && restSeconds > 0) setRestEndAt(Date.now() + restSeconds * 1000);
    const info = infos[ex.exercise_id];
    if (!quiet && !set.is_warmup && info && info.pr > 0 && epley(set.weight, set.reps) > info.pr + 0.05) {
      notify(`🎉 ${ex.name}: yeni rekor! (tahmini 1RM ${fmtNum(epley(set.weight, set.reps))} kg)`, 'success');
      setInfos(prev => ({ ...prev, [ex.exercise_id]: { ...prev[ex.exercise_id], pr: epley(set.weight, set.reps) } }));
    }
  };
  const updateSet = async (id, patch) => replaceWorkout(await api('PUT', `/api/health/sets/${id}`, patch));
  const deleteSet = async (id) => replaceWorkout(await api('DELETE', `/api/health/sets/${id}`));

  const openWorkout = async (workoutDate, workoutId) => {
    try {
      const list = await api('GET', `/api/health/workouts?from=${workoutDate}&to=${workoutDate}`);
      const w = list.find(x => x.id === workoutId) || list[0];
      if (w) setDetail(w);
    } catch { /* toast shown */ }
  };
  const goToDate = (d) => {
    setDetail(null);
    setDate(d);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const thisWeek = summary[summary.length - 1];
  const weekStart = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const cur = thisWeek && thisWeek.week === weekStart ? thisWeek : { sessions: 0, sets: 0, volume: 0 };
  const prevWeek = summary.find(s => s.week === addDays(weekStart, -7));
  const volDiff = prevWeek && prevWeek.volume > 0 ? Math.round(((cur.volume - prevWeek.volume) / prevWeek.volume) * 100) : null;

  const workoutVolume = (w) => Math.round(w.exercises.flatMap(e => e.sets).filter(s => !s.is_warmup).reduce((a, s) => a + s.weight * s.reps, 0));
  const pastWorkouts = recent.filter(w => w.workout_date !== date);
  const normTitle = (t) => String(t || '').toLocaleLowerCase('tr').trim();
  // Most recent earlier workout with the same name that has exercises (e.g. last "Push")
  const sameTitle = (title) => (normTitle(title) ? recent.find(w => w.workout_date < date && normTitle(w.title) === normTitle(title) && w.exercises.length > 0) : null);
  const titleSuggestions = [...new Set(recent.map(w => (w.title || '').trim()).filter(Boolean))];

  return (
    <div className="health-view">
      <div className="date-bar glass-card">
        <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Önceki gün"><ChevronLeft /></button>
        <div className="date-bar-mid">
          <strong>{niceDate(date)}</strong>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tarih seç" />
        </div>
        <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Sonraki gün"><ChevronRight /></button>
        {date !== todayStr() && <button type="button" className="chip-btn" onClick={() => setDate(todayStr())}><RotateCcw size={13} /> Bugün</button>}
      </div>

      <div className="rest-setting">
        <Timer size={15} /> <span>Set arası dinlenme:</span>
        {REST_CHOICES.map(v => <button type="button" key={v} className={`chip small ${restSeconds === v ? 'on' : ''}`} onClick={() => chooseRest(v)}>{v >= 120 ? `${v / 60} dk` : `${v} sn`}</button>)}
        <button type="button" className={`chip small ${restSeconds === 0 ? 'on' : ''}`} onClick={() => chooseRest(0)}>Kapalı</button>
      </div>

      <div className="week-strip">
        <div><span>Bu hafta</span><b>{cur.sessions}</b><small>antrenman</small></div>
        <div><span>Set</span><b>{cur.sets}</b><small>bu hafta</small></div>
        <div><span>Hacim</span><b>{fmtNum(cur.volume / 1000, 1)} t</b><small>{volDiff === null ? 'geçen hafta yok' : `${volDiff >= 0 ? '+' : ''}${volDiff}% geçen haftaya göre`}</small></div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner"></div></div>
      ) : (
        <>
          {workouts.length === 0 && (
            <div className="glass-card start-card">
              <Dumbbell size={34} />
              <h3>{date === todayStr() ? 'Bugün antrenman var mı?' : 'Bu gün antrenman yok'}</h3>
              <p className="muted">Bir isim seç ve başla. Daha önce yaptığın bir isimse (↻) hareketleri otomatik gelir.</p>
              <div className="chip-row center">
                {[...new Set([...titleSuggestions.slice(0, 6), ...TITLE_CHIPS])].map(t => <button type="button" key={t} className="chip" onClick={() => startWorkout(t)} title={sameTitle(t) ? `Geçen ${t} antrenmanının hareketleri otomatik gelir` : ''}>{t}{sameTitle(t) ? ' ↻' : ''}</button>)}
              </div>
              <button type="button" className="btn btn-primary big-btn" onClick={() => startWorkout('')}><Plus /> Antrenmanı başlat</button>
              {pastWorkouts.length > 0 && (
                <div className="copy-box">
                  <small>Ya da önceki bir antrenmanı kopyala:</small>
                  {pastWorkouts.slice(0, 3).map(w => (
                    <button type="button" key={w.id} className="copy-item" onClick={() => copyWorkout(w.id)}>
                      <Copy size={14} /> {shortDate(w.workout_date)} · {w.title || 'Antrenman'} <small>{w.exercises.map(e => e.name).slice(0, 3).join(', ')}{w.exercises.length > 3 ? '…' : ''}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {workouts.map(w => (
            <div key={w.id} className="workout">
              <div className="workout-head">
                <input
                  className="workout-title"
                  list="workout-titles"
                  defaultValue={w.title}
                  placeholder="Antrenman adı (örn. Push)"
                  onBlur={(e) => renameWorkout(w, e.target.value.trim())}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className="muted">{w.exercises.length} hareket · {fmtNum(workoutVolume(w), 0)} kg</span>
                <button type="button" className="icon-btn" onClick={() => deleteWorkout(w)} aria-label="Antrenmanı sil"><Trash2 size={17} /></button>
              </div>

              {(() => {
                const prev = sameTitle(w.title);
                if (!prev) return null;
                const have = new Set(w.exercises.map(e => e.exercise_id));
                const missing = prev.exercises.filter(e => !have.has(e.exercise_id));
                if (missing.length === 0) return null;
                return (
                  <button type="button" className="import-banner" onClick={() => importFrom(w, prev)}>
                    <RotateCcw size={16} />
                    <span>
                      <b>Geçen “{prev.title}” antrenmanından {have.size ? `eksik ${missing.length} hareketi` : `${missing.length} hareketi`} getir</b>
                      <small>{missing.map(e => e.name).join(', ')}</small>
                    </span>
                  </button>
                );
              })()}

              {w.exercises.map(ex => (
                <ExerciseBlock
                  key={ex.id}
                  ex={ex}
                  info={infos[ex.exercise_id]}
                  onAddSet={addSet}
                  onUpdateSet={updateSet}
                  onDeleteSet={deleteSet}
                  onRemove={removeExercise}
                />
              ))}

              <button type="button" className="btn btn-secondary add-ex-btn" onClick={() => setPickerFor(w.id)}>
                <Plus size={18} /> Hareket ekle
              </button>
            </div>
          ))}
        </>
      )}

      <div className="health-grid">
        <ProgressPanel exercises={exercises} onOpenWorkout={openWorkout} />
        <BodyWeightCard />
      </div>

      {pastWorkouts.length > 0 && (
        <div className="glass-card health-card">
          <h3><History size={18} /> Son antrenmanlar</h3>
          <div className="recent-list">
            {pastWorkouts.map(w => (
              <button type="button" key={w.id} className="recent-item" onClick={() => setDetail(w)}>
                <span><b>{shortDate(w.workout_date)}</b> {w.title || 'Antrenman'}</span>
                <small>{w.exercises.length} hareket · {fmtNum(workoutVolume(w), 0)} kg</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <datalist id="workout-titles">
        {titleSuggestions.map(t => <option key={t} value={t} />)}
      </datalist>

      {restEndAt > 0 && (
        <RestTimer endAt={restEndAt} onSkip={() => setRestEndAt(0)} onAdd={(sec) => setRestEndAt(t => t + sec * 1000)} />
      )}

      {detail && (
        <WorkoutDetailModal
          workout={detail}
          onClose={() => setDetail(null)}
          onGo={goToDate}
          onCopy={(w) => { setDetail(null); copyWorkout(w.id); }}
        />
      )}

      {pickerFor && (
        <ExercisePicker
          exercises={exercises}
          recent={recentSessions}
          suggestedIds={(sameTitle(workouts.find(w => w.id === pickerFor)?.title)?.exercises || []).map(e => e.exercise_id)}
          usedIds={(workouts.find(w => w.id === pickerFor)?.exercises || []).map(e => e.exercise_id)}
          onClose={closePicker}
          onChanged={() => { api('GET', '/api/health/exercises').then(setExercises).catch(() => {}); loadAll(); }}
          onPick={(e) => addExercise(pickerFor, { exercise_id: e.id })}
          onCreate={(name, muscle) => addExercise(pickerFor, { name, muscle })}
        />
      )}
    </div>
  );
}
