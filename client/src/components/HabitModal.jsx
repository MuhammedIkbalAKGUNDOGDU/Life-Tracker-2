import React, { useState, useEffect } from 'react';
import { X, Flame } from 'lucide-react';

export default function HabitModal({
  isOpen,
  habit,
  onClose,
  onSaveHabit
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [customCategory, setCustomCategory] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [customDays, setCustomDays] = useState([]); // Array of numbers 1-7
  const [targetCount, setTargetCount] = useState(1);
  const [weeklyTargets, setWeeklyTargets] = useState([1, 1, 1, 1, 1, 1, 1]);

  // Sync state when modal opens
  useEffect(() => {
    if (habit) {
      setTitle(habit.title || '');
      setDescription(habit.description || '');
      
      const cat = habit.category || 'general';
      if (['health', 'career', 'finance', 'education', 'social', 'general'].includes(cat)) {
        setCategory(cat);
        setCustomCategory('');
      } else {
        setCategory('other');
        setCustomCategory(cat);
      }
      
      setFrequency(habit.frequency || 'daily');
      setCustomDays(habit.custom_days || []);
      setTargetCount(habit.target_count || 1);
      setWeeklyTargets(habit.weekly_targets && habit.weekly_targets.length === 7 ? habit.weekly_targets : [1, 1, 1, 1, 1, 1, 1]);
    } else {
      setTitle('');
      setDescription('');
      setCategory('general');
      setCustomCategory('');
      setFrequency('daily');
      setCustomDays([]);
      setTargetCount(1);
      setWeeklyTargets([1, 1, 1, 1, 1, 1, 1]);
    }
  }, [habit, isOpen]);

  if (!isOpen) return null;

  const handleDayToggle = (dayNum) => {
    setCustomDays(prev => 
      prev.includes(dayNum) 
        ? prev.filter(d => d !== dayNum) 
        : [...prev, dayNum].sort()
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (frequency === 'custom' && customDays.length === 0) {
      alert('Lütfen haftanın en az bir gününü seçin!');
      return;
    }

    onSaveHabit({
      id: habit ? habit.id : null,
      title: title.trim(),
      description: description.trim(),
      category: category === 'other' ? (customCategory.trim() || 'Diğer') : category,
      frequency,
      custom_days: frequency === 'custom' ? customDays : [],
      target_count: parseInt(targetCount) || 1,
      weekly_targets: frequency === 'weekly_targets' ? weeklyTargets : null
    });
  };

  const dayNames = [
    { label: 'Pt', value: 1 },
    { label: 'Sa', value: 2 },
    { label: 'Ça', value: 3 },
    { label: 'Pe', value: 4 },
    { label: 'Cu', value: 5 },
    { label: 'Ct', value: 6 },
    { label: 'Pz', value: 7 }
  ];

  return (
    <div className="modal-backdrop open">
      <div className="modal glass-card" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{habit ? 'Alışkanlığı Düzenle' : 'Yeni Alışkanlık Ekle'}</h2>
          <button className="btn-close" onClick={onClose} type="button">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px' }}>
            
            <div className="form-group">
              <label>Alışkanlık Başlığı</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Örn: Kitap okumak, Su içmek..."
              />
            </div>

            <div className="form-group">
              <label>Açıklama / Not</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="2"
                placeholder="Alışkanlık hakkında ek not..."
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="general">Genel</option>
                  <option value="health">Sağlık / Spor</option>
                  <option value="career">Kariyer / İş</option>
                  <option value="finance">Finans</option>
                  <option value="education">Gelişim / Eğitim</option>
                  <option value="social">Sosyal / Aile</option>
                  <option value="other">Diğer / Özel...</option>
                </select>
              </div>

              <div className="form-group">
                <label>Günlük Hedef Miktar</label>
                <input
                  type="number"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  placeholder="örn: 1 (günde 1 kez)"
                />
              </div>
            </div>

            {category === 'other' && (
              <div className="form-group animate-fade-in">
                <label>Özel Kategori Adı</label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                  placeholder="Kendi kategori adınızı yazın..."
                  maxLength="50"
                />
              </div>
            )}

             <div className="form-group">
              <label>Sıklık (Frequency)</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="daily">Her Gün (Daily)</option>
                <option value="custom">Haftanın Belirli Günleri</option>
                <option value="weekly_targets">Haftalık Gün Bazlı Hedefler</option>
              </select>
            </div>

            {frequency === 'custom' && (
              <div className="form-group animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <label style={{ marginBottom: '8px' }}>Hangi Günler Yapılacak?</label>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                  {dayNames.map(day => {
                    const isSelected = customDays.includes(day.value);
                    return (
                      <button
                        type="button"
                        key={day.value}
                        onClick={() => handleDayToggle(day.value)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          fontFamily: 'inherit',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all var(--transition-speed)'
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {frequency === 'weekly_targets' && (
              <div className="form-group animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <label style={{ marginBottom: '12px', display: 'block' }}>Günlük Hedef Miktarları (0 = Yapılmayacak/Hariç)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {dayNames.map((day, idx) => (
                    <div key={day.value} className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{day.label}</label>
                      <input
                        type="number"
                        value={weeklyTargets[idx] ?? 1}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setWeeklyTargets(prev => {
                            const next = [...prev];
                            next[idx] = val;
                            return next;
                          });
                        }}
                        min="0"
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}
