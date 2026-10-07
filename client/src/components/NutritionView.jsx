import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Search, Settings, RotateCcw, Pencil, Globe, BookOpen, PlusCircle, Copy } from 'lucide-react';
import NumInput from './NumInput';
import ModalShell from './ModalShell';
import { confirmDialog, notify } from '../ui';
import { api, todayStr, addDays, niceDate, fmtNum } from '../healthApi';

const MEALS = [
  { key: 'kahvalti', label: 'Kahvaltı', emoji: '🌅' },
  { key: 'ogle', label: 'Öğle', emoji: '☀️' },
  { key: 'aksam', label: 'Akşam', emoji: '🌙' },
  { key: 'ara', label: 'Ara öğün', emoji: '🍎' }
];

const scale = (food, grams) => {
  const f = (Number(grams) || 0) / 100;
  const r = (v) => Math.round((Number(v) || 0) * f * 10) / 10;
  return { kcal: r(food.kcal), protein: r(food.protein), carbs: r(food.carbs), fat: r(food.fat), fiber: r(food.fiber), sugar: r(food.sugar), salt: r(food.salt) };
};

const EMPTY_FOOD = { name: '', brand: '', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, serving_g: 100, serving_label: 'porsiyon' };

// ---------- food picker (search / Open Food Facts / new) ----------

function FoodForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ ...EMPTY_FOOD, ...initial });
  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));
  const submit = (e) => { e.preventDefault(); if (f.name.trim()) onSave(f); };
  return (
    <form className="food-form" onSubmit={submit}>
      <div className="form-group"><label>Yemek adı</label><input type="text" value={f.name} onChange={(e) => set('name')(e.target.value)} required placeholder="Örn. Tavuk göğsü (haşlanmış)" /></div>
      <p className="muted small">Değerleri <b>100 gram</b> için gir (paketin arkasındaki tablo gibi).</p>
      <div className="macro-inputs">
        <label>Kalori (kcal)<NumInput value={f.kcal} onChange={set('kcal')} min={0} /></label>
        <label>Protein (g)<NumInput value={f.protein} onChange={set('protein')} min={0} /></label>
        <label>Karbonhidrat (g)<NumInput value={f.carbs} onChange={set('carbs')} min={0} /></label>
        <label>Yağ (g)<NumInput value={f.fat} onChange={set('fat')} min={0} /></label>
        <label>Lif (g)<NumInput value={f.fiber} onChange={set('fiber')} min={0} /></label>
        <label>Şeker (g)<NumInput value={f.sugar} onChange={set('sugar')} min={0} /></label>
        <label>Tuz (g)<NumInput value={f.salt} onChange={set('salt')} min={0} /></label>
      </div>
      <div className="form-row-2">
        <div className="form-group"><label>1 porsiyon / adet kaç gram?</label><NumInput value={f.serving_g} onChange={set('serving_g')} min={1} emptyValue={100} /></div>
        <div className="form-group"><label>Porsiyon adı</label><input type="text" value={f.serving_label} onChange={(e) => set('serving_label')(e.target.value)} placeholder="adet, dilim, kaşık…" /></div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Geri</button>
        <button type="submit" className="btn btn-primary">Kaydet</button>
      </div>
    </form>
  );
}

function FoodPicker({ meal: initialMeal, date, onClose, onAdded }) {
  const [tab, setTab] = useState('saved'); // saved | off | new
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState([]);
  const [off, setOff] = useState([]);
  const [offBusy, setOffBusy] = useState(false);
  const [chosen, setChosen] = useState(null); // food waiting for grams
  const [editing, setEditing] = useState(null); // food being edited / created
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState(initialMeal);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const loadSaved = useCallback(async (query) => {
    try { setSaved(await api('GET', `/api/health/foods?q=${encodeURIComponent(query)}`)); } catch { /* toast shown */ }
  }, []);
  useEffect(() => { const t = setTimeout(() => loadSaved(q), 200); return () => clearTimeout(t); }, [q, loadSaved]);
  useEffect(() => { inputRef.current?.focus(); }, [tab, chosen]);

  const searchOff = async () => {
    if (q.trim().length < 2) return;
    setOffBusy(true);
    try { setOff(await api('GET', `/api/health/foods/off?q=${encodeURIComponent(q.trim())}`)); } catch { setOff([]); }
    setOffBusy(false);
  };

  const choose = async (food) => {
    let f = food;
    if (!f.id) f = await api('POST', '/api/health/foods', food); // save OFF result so it shows up in "Kayıtlı" next time
    setChosen(f);
    setGrams(Number(f.serving_g) > 0 && f.source === 'off' ? Number(f.serving_g) : 100);
  };

  const saveFood = async (food) => {
    const saved = food.id ? await api('PUT', `/api/health/foods/${food.id}`, food) : await api('POST', '/api/health/foods', food);
    setEditing(null);
    loadSaved(q);
    if (!food.id) choose(saved);
  };

  const removeFood = async (food) => {
    const ok = await confirmDialog({ title: 'Yemek silinsin mi?', message: `"${food.name}" listenden silinecek. Geçmiş kayıtların değişmez.`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    await api('DELETE', `/api/health/foods/${food.id}`);
    loadSaved(q);
  };

  const add = async (keepOpen) => {
    if (!(grams > 0) || busy) return;
    setBusy(true);
    try {
      await api('POST', '/api/health/meals', { food_id: chosen.id, grams, meal, log_date: date });
      notify(`${chosen.name} eklendi.`, 'success');
      onAdded();
      if (keepOpen) { setChosen(null); setQ(''); } else onClose();
    } finally {
      setBusy(false);
    }
  };

  const preview = chosen ? scale(chosen, grams) : null;
  const quick = chosen ? [50, 100, 150, 200, 250] : [];

  return (
    <ModalShell onClose={onClose} className="sheet" style={{ maxWidth: '560px' }}>
      <div className="modal-header">
        <h2>{chosen ? chosen.name : editing ? (editing.id ? 'Yemeği düzenle' : 'Yeni yemek') : 'Yemek ekle'}</h2>
        <button className="btn-close" data-modal-close type="button"><X /></button>
      </div>

      {editing ? (
        <div className="picker"><FoodForm initial={editing} onSave={saveFood} onCancel={() => setEditing(null)} /></div>
      ) : chosen ? (
        <div className="picker">
          <p className="muted small">{chosen.brand ? `${chosen.brand} · ` : ''}100 g: {fmtNum(chosen.kcal, 0)} kcal · P {fmtNum(chosen.protein)} · K {fmtNum(chosen.carbs)} · Y {fmtNum(chosen.fat)}</p>
          <div className="grams-box">
            <label>Miktar (gram)</label>
            <div className="grams-row">
              <button type="button" onClick={() => setGrams(g => Math.max(0, g - 10))}>−</button>
              <NumInput value={grams} onChange={setGrams} min={0} inputMode="decimal" />
              <button type="button" onClick={() => setGrams(g => g + 10)}>+</button>
            </div>
            <div className="chip-row">
              {quick.map(g => <button type="button" key={g} className={`chip ${grams === g ? 'on' : ''}`} onClick={() => setGrams(g)}>{g} g</button>)}
              {Number(chosen.serving_g) > 0 && Number(chosen.serving_g) !== 100 && (
                <button type="button" className="chip" onClick={() => setGrams(Number(chosen.serving_g))}>1 {chosen.serving_label || 'porsiyon'} = {fmtNum(chosen.serving_g, 0)} g</button>
              )}
              {Number(chosen.serving_g) > 0 && Number(chosen.serving_g) !== 100 && (
                <button type="button" className="chip" onClick={() => setGrams(Math.round(Number(chosen.serving_g) * 2))}>2 {chosen.serving_label || 'porsiyon'}</button>
              )}
            </div>
          </div>
          <div className="preview">
            <div><b>{fmtNum(preview.kcal, 0)}</b><small>kcal</small></div>
            <div><b>{fmtNum(preview.protein)}</b><small>protein</small></div>
            <div><b>{fmtNum(preview.carbs)}</b><small>karb.</small></div>
            <div><b>{fmtNum(preview.fat)}</b><small>yağ</small></div>
          </div>
          <div className="chip-row">
            {MEALS.map(m => <button type="button" key={m.key} className={`chip ${meal === m.key ? 'on' : ''}`} onClick={() => setMeal(m.key)}>{m.emoji} {m.label}</button>)}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setChosen(null)}>Geri</button>
            <button type="button" className="btn btn-secondary" onClick={() => add(true)} disabled={busy}>Ekle, devam et</button>
            <button type="button" className="btn btn-primary" onClick={() => add(false)} disabled={busy}>Ekle</button>
          </div>
        </div>
      ) : (
        <div className="picker">
          <div className="tabs-mini">
            <button type="button" className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}><BookOpen size={15} /> Kayıtlı</button>
            <button type="button" className={tab === 'off' ? 'on' : ''} onClick={() => setTab('off')}><Globe size={15} /> Ürün ara</button>
            <button type="button" className="new" onClick={() => setEditing({ ...EMPTY_FOOD, name: q })}><PlusCircle size={15} /> Yeni</button>
          </div>
          <div className="picker-search">
            <Search size={16} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (tab === 'off' && e.key === 'Enter') { e.preventDefault(); searchOff(); } }}
              placeholder={tab === 'off' ? 'Ürün adı yaz, Enter’a bas (Open Food Facts)' : 'Yemek ara… (yumurta, pilav, yulaf)'}
            />
          </div>

          {tab === 'saved' ? (
            <div className="picker-list">
              {saved.map(f => (
                <div key={f.id} className="picker-item food">
                  <button type="button" className="picker-main" onClick={() => choose(f)}>
                    <span><b>{f.name}</b><small>{f.brand ? `${f.brand} · ` : ''}100 g: {fmtNum(f.kcal, 0)} kcal · P {fmtNum(f.protein)} · K {fmtNum(f.carbs)} · Y {fmtNum(f.fat)}</small></span>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => setEditing(f)} aria-label="Düzenle"><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" onClick={() => removeFood(f)} aria-label="Sil"><Trash2 size={15} /></button>
                </div>
              ))}
              {saved.length === 0 && (
                <div className="empty-hint">
                  <p>{q ? `“${q}” kayıtlı değil.` : 'Henüz kayıtlı yemek yok.'}</p>
                  <button type="button" className="btn btn-secondary" onClick={() => { setTab('off'); if (q.trim().length >= 2) searchOff(); }}><Globe size={16} /> Ürün veritabanında ara</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing({ ...EMPTY_FOOD, name: q })}><PlusCircle size={16} /> Elle ekle</button>
                </div>
              )}
            </div>
          ) : (
            <div className="picker-list">
              <button type="button" className="btn btn-primary" onClick={searchOff} disabled={offBusy || q.trim().length < 2}>{offBusy ? 'Aranıyor…' : 'Ara'}</button>
              {off.map((f, i) => (
                <button type="button" key={`${f.barcode}-${i}`} className="picker-item" onClick={() => choose(f)}>
                  <span><b>{f.name}</b><small>{f.brand ? `${f.brand} · ` : ''}100 g: {fmtNum(f.kcal, 0)} kcal · P {fmtNum(f.protein)} · K {fmtNum(f.carbs)} · Y {fmtNum(f.fat)}</small></span>
                  <Plus size={18} />
                </button>
              ))}
              {!offBusy && off.length === 0 && <p className="muted small">Paketli ürünleri Open Food Facts (ücretsiz, ortak veritabanı) üzerinden arar. Bulamazsan “Yeni” ile elle ekle. Değerler gönüllüler tarafından girildiği için paketten kontrol etmen iyi olur.</p>}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// ---------- targets / profile ----------

function SettingsModal({ settings, onClose, onSaved }) {
  const p = settings.profile || {};
  const [profile, setProfile] = useState({ height: p.height || 175, weight: p.weight || 75, age: p.age || 25, sex: p.sex || 'm', activity: p.activity || 'moderate', goal: p.goal || 'maintain' });
  const [ov, setOv] = useState({ kcal: settings.overrides?.kcal || 0, protein: settings.overrides?.protein || 0, carbs: settings.overrides?.carbs || 0, fat: settings.overrides?.fat || 0 });
  const [auto, setAuto] = useState(settings.auto);

  // Live preview of the automatic targets (same formula as the server)
  useEffect(() => {
    const { height, weight, age, sex, activity, goal } = profile;
    if (!height || !weight || !age) { setAuto(null); return; }
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5);
    const tdee = bmr * ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[activity] || 1.55);
    const kcal = Math.round(tdee + ({ lose: -400, maintain: 0, gain: 300 }[goal] ?? 0));
    const protein = Math.round(weight * (goal === 'lose' ? 2.2 : 1.8));
    const fat = Math.round((kcal * 0.27) / 9);
    setAuto({ kcal, protein, fat, carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), tdee: Math.round(tdee) });
  }, [profile]);

  const save = async (e) => {
    e.preventDefault();
    const res = await api('PUT', '/api/health/settings', { profile, overrides: ov });
    notify('Hedefler kaydedildi.', 'success');
    onSaved(res);
    onClose();
  };
  const setP = (k) => (v) => setProfile(prev => ({ ...prev, [k]: v }));
  const field = (k, label, unit) => (
    <label className="ov-field">
      <span>{label}</span>
      <NumInput value={ov[k]} onChange={(v) => setOv(prev => ({ ...prev, [k]: v }))} min={0} placeholder={auto ? String(auto[k]) : ''} />
      <small>{unit} {ov[k] > 0 ? <button type="button" className="link-btn" onClick={() => setOv(prev => ({ ...prev, [k]: 0 }))}>otomatiğe dön</button> : auto ? `(otomatik: ${auto[k]})` : ''}</small>
    </label>
  );

  return (
    <ModalShell onClose={onClose} style={{ maxWidth: '560px' }}>
      <div className="modal-header"><h2>Günlük hedefler</h2><button className="btn-close" data-modal-close type="button"><X /></button></div>
      <form onSubmit={save} className="modal-form">
        <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '20px 24px' }}>
          <p className="muted small">Bilgilerini gir, hedeflerini ben hesaplayayım. Beğenmediğin değeri aşağıdan kendin yazabilirsin, o zaman senin yazdığın geçerli olur.</p>
          <div className="macro-inputs">
            <label>Boy (cm)<NumInput value={profile.height} onChange={setP('height')} min={100} /></label>
            <label>Kilo (kg)<NumInput value={profile.weight} onChange={setP('weight')} min={30} /></label>
            <label>Yaş<NumInput value={profile.age} onChange={setP('age')} min={14} integer /></label>
            <label>Cinsiyet<select value={profile.sex} onChange={(e) => setP('sex')(e.target.value)}><option value="m">Erkek</option><option value="f">Kadın</option></select></label>
            <label>Aktivite<select value={profile.activity} onChange={(e) => setP('activity')(e.target.value)}><option value="sedentary">Hareketsiz</option><option value="light">Hafif (haftada 1-3)</option><option value="moderate">Orta (3-5 gün spor)</option><option value="active">Çok aktif (6-7 gün)</option></select></label>
            <label>Hedef<select value={profile.goal} onChange={(e) => setP('goal')(e.target.value)}><option value="lose">Kilo ver</option><option value="maintain">Koru</option><option value="gain">Kas / kilo al</option></select></label>
          </div>
          {auto && <div className="auto-box">Günlük harcaman ≈ <b>{auto.tdee} kcal</b>. Önerilen hedef: <b>{auto.kcal} kcal</b> · P {auto.protein} g · K {auto.carbs} g · Y {auto.fat} g</div>}
          <div className="ov-grid">
            {field('kcal', 'Kalori', 'kcal')}
            {field('protein', 'Protein', 'g')}
            {field('carbs', 'Karbonhidrat', 'g')}
            {field('fat', 'Yağ', 'g')}
          </div>
        </div>
        <div className="modal-footer">
          <span className="modal-hint">Ctrl+Enter kaydeder</span>
          <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
          <button type="submit" className="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- main view ----------

function MacroBar({ label, value, target, color }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target;
  return (
    <div className="macro-bar">
      <div className="macro-bar-top"><span>{label}</span><b>{fmtNum(value, 0)}{target > 0 ? ` / ${fmtNum(target, 0)} g` : ' g'}</b></div>
      <div className="macro-track"><div style={{ width: `${pct}%`, background: over ? '#ef4444' : color }} /></div>
    </div>
  );
}

export default function NutritionView() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [picker, setPicker] = useState(null); // meal key
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('GET', `/api/health/meals?date=${date}`)); } catch { /* toast */ }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const updateGrams = async (item, grams) => {
    if (!(grams > 0) || grams === item.grams) return;
    await api('PUT', `/api/health/meals/${item.id}`, { grams });
    load();
  };
  const remove = async (item) => {
    await api('DELETE', `/api/health/meals/${item.id}`);
    load();
    notify(`${item.food_name} silindi.`, 'info');
  };
  const copyYesterday = async () => {
    const prev = await api('GET', `/api/health/meals?date=${addDays(date, -1)}`);
    if (prev.items.length === 0) return notify('Dün için kayıt yok.', 'info');
    for (const it of prev.items) {
      if (it.food_id) await api('POST', '/api/health/meals', { food_id: it.food_id, grams: it.grams, meal: it.meal, log_date: date });
    }
    notify(`${prev.items.length} kayıt dünden kopyalandı.`, 'success');
    load();
  };

  const t = data?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };
  const tg = data?.targets || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const remaining = tg.kcal - t.kcal;
  const pct = tg.kcal > 0 ? Math.min(100, (t.kcal / tg.kcal) * 100) : 0;
  const over = tg.kcal > 0 && t.kcal > tg.kcal;

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
        <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Hedefler"><Settings size={19} /></button>
      </div>

      <div className="glass-card nutrition-summary">
        <div className="kcal-ring" style={{ background: `conic-gradient(${over ? '#ef4444' : 'var(--success)'} ${pct * 3.6}deg, rgba(148,163,184,.18) 0deg)` }}>
          <div className="kcal-ring-inner">
            <strong>{fmtNum(t.kcal, 0)}</strong>
            <span>{tg.kcal > 0 ? `/ ${fmtNum(tg.kcal, 0)} kcal` : 'kcal'}</span>
          </div>
        </div>
        <div className="macros">
          {tg.kcal > 0 ? (
            <p className={`remaining ${over ? 'over' : ''}`}>{over ? `${fmtNum(-remaining, 0)} kcal fazla` : `${fmtNum(remaining, 0)} kcal kaldı`}</p>
          ) : (
            <button type="button" className="chip-btn" onClick={() => setSettingsOpen(true)}>Günlük hedef belirle</button>
          )}
          <MacroBar label="Protein" value={t.protein} target={tg.protein} color="#6366f1" />
          <MacroBar label="Karbonhidrat" value={t.carbs} target={tg.carbs} color="#f59e0b" />
          <MacroBar label="Yağ" value={t.fat} target={tg.fat} color="#10b981" />
          <small className="muted">Lif {fmtNum(t.fiber)} g · Şeker {fmtNum(t.sugar)} g · Tuz {fmtNum(t.salt, 2)} g</small>
        </div>
      </div>

      {MEALS.map(m => {
        const items = (data?.items || []).filter(i => i.meal === m.key);
        const kcal = items.reduce((a, i) => a + i.kcal, 0);
        return (
          <section key={m.key} className="meal glass-card">
            <header>
              <h4>{m.emoji} {m.label}</h4>
              <span className="muted">{fmtNum(kcal, 0)} kcal</span>
              <button type="button" className="chip-btn" onClick={() => setPicker(m.key)}><Plus size={14} /> Ekle</button>
            </header>
            {items.length === 0 ? (
              <button type="button" className="meal-empty" onClick={() => setPicker(m.key)}>+ {m.label} ekle</button>
            ) : (
              items.map(i => (
                <div key={i.id} className="meal-item">
                  <div className="meal-item-name">
                    <b>{i.food_name}</b>
                    <small>P {fmtNum(i.protein)} · K {fmtNum(i.carbs)} · Y {fmtNum(i.fat)}</small>
                  </div>
                  <label className="meal-grams">
                    <NumInput key={`${i.id}-${i.grams}`} value={i.grams} onChange={() => {}} onBlur={(e) => updateGrams(i, parseFloat(e.target.value))} min={1} emptyValue={i.grams} inputMode="decimal" aria-label="Gram" />
                    <small>g</small>
                  </label>
                  <b className="meal-kcal">{fmtNum(i.kcal, 0)}<small> kcal</small></b>
                  <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label="Sil"><Trash2 size={16} /></button>
                </div>
              ))
            )}
          </section>
        );
      })}

      {data && data.items.length === 0 && (
        <button type="button" className="btn btn-secondary" onClick={copyYesterday}><Copy size={16} /> Dünkü öğünleri kopyala</button>
      )}

      {picker && <FoodPicker meal={picker} date={date} onClose={() => setPicker(null)} onAdded={load} />}
      {settingsOpen && data && <SettingsModal settings={data.targets} onClose={() => setSettingsOpen(false)} onSaved={load} />}
    </div>
  );
}

