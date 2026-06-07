import React, { useState, useEffect } from 'react';
import { X, Flame, Target } from 'lucide-react';

export default function GoalModal({
  isOpen,
  goal,
  onClose,
  onSaveGoal
}) {
  const [title, setTitle] = useState('');
  const [whyNote, setWhyNote] = useState('');
  const [category, setCategory] = useState('general');
  const [customCategory, setCustomCategory] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState(3);
  const [progressType, setProgressType] = useState('boolean');
  const [linkUrl, setLinkUrl] = useState('');
  
  // Metric properties
  const [currentValue, setCurrentValue] = useState(0);
  const [targetValue, setTargetValue] = useState(1);
  const [unit, setUnit] = useState('');

  // Sync state with selected goal when modal opens
  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '');
      setWhyNote(goal.why_note || '');
      const cat = goal.category || 'general';
      if (['health', 'career', 'finance', 'education', 'social', 'general'].includes(cat)) {
        setCategory(cat);
        setCustomCategory('');
      } else {
        setCategory('other');
        setCustomCategory(cat);
      }
      setTargetDate(goal.target_date ? goal.target_date.substring(0, 10) : '');
      setPriority(goal.priority || 3);
      setProgressType(goal.progress_type || 'boolean');
      setLinkUrl(goal.link_url || '');
      setCurrentValue(parseFloat(goal.current_value) || 0);
      setTargetValue(parseFloat(goal.target_value) || 1);
      setUnit(goal.unit || '');
    } else {
      setTitle('');
      setWhyNote('');
      setCategory('general');
      setCustomCategory('');
      setTargetDate('');
      setPriority(3);
      setProgressType('boolean');
      setLinkUrl('');
      setCurrentValue(0);
      setTargetValue(1);
      setUnit('');
    }
  }, [goal, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveGoal({
      id: goal ? goal.id : null,
      title: title.trim(),
      why_note: whyNote.trim(),
      category: category === 'other' ? (customCategory.trim() || 'Diğer') : category,
      target_date: targetDate || null,
      priority: parseInt(priority) || 3,
      progress_type: progressType,
      link_url: linkUrl.trim(),
      current_value: progressType === 'metric' ? parseFloat(currentValue) || 0 : 0,
      target_value: progressType === 'metric' ? parseFloat(targetValue) || 1 : 1,
      unit: progressType === 'metric' ? unit.trim() : ''
    });
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal glass-card" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2>{goal ? 'Hedefi Düzenle' : 'Yeni Hedef Ekle'}</h2>
          <button className="btn-close" onClick={onClose} type="button">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px' }}>
            
            <div className="form-group">
              <label>Hedef Başlığı</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Örn: Haftada 3 gün spor yap..."
              />
            </div>

            <div className="form-group">
              <label className="label-with-icon">
                <Flame size={14} style={{ color: 'var(--warning)' }} /> Motivasyon / Bu Hedef Neden Önemli?
              </label>
              <textarea
                value={whyNote}
                onChange={(e) => setWhyNote(e.target.value)}
                rows="2"
                placeholder="Bu hedefe ulaştığında ne hissedeceksin? İtici gücünü yaz..."
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
                <label>Önem Önceliği</label>
                <select value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
                  <option value="1">1 - Düşük</option>
                  <option value="2">2 - Orta-Düşük</option>
                  <option value="3">3 - Orta</option>
                  <option value="4">4 - Yüksek</option>
                  <option value="5">5 - Kritik</option>
                </select>
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

            <div className="form-row-2">
              <div className="form-group">
                <label>Hedef İlerleme Tipi</label>
                <select value={progressType} onChange={(e) => setProgressType(e.target.value)}>
                  <option value="boolean">Basit Alışkanlık (Evet/Hayır)</option>
                  <option value="metric">Ölçülebilir Hedef (Miktar Bazlı)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Hedeflenen Tarih (Deadline)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Hedef Detay Linki (URL)</label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Örn: https://example.com/detaylar..."
              />
            </div>

            {progressType === 'metric' && (
              <div className="add-task-inline animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', border: '1px solid var(--glass-border)' }}>
                <div className="form-row-2" style={{ width: '100%', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px' }}>Mevcut Miktar</label>
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px' }}>Hedeflenen Miktar</label>
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(Math.max(1, parseFloat(e.target.value) || 1))}
                      min="1"
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '10px' }}>Birim (Adet, Saat, Sayfa...)</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="örn: kitap, saat, km"
                    />
                  </div>
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
