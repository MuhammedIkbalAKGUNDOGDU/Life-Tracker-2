import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function MilestoneModal({
  isOpen,
  onClose,
  onSaveMilestone
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [targetType, setTargetType] = useState('manual');
  const [targetValue, setTargetValue] = useState(1);

  // Reset fields when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setReward('');
      setTargetType('manual');
      setTargetValue(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveMilestone({
      title: title.trim(),
      description: description.trim(),
      reward: reward.trim(),
      target_type: targetType,
      target_value: targetType === 'manual' ? 1 : parseInt(targetValue) || 1
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal glass-card" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Başarım Ekle</h2>
          <button className="btn-close" onClick={onClose} type="button">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px' }}>
            
            <div className="form-group">
              <label>Başarım Başlığı</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Örn: Proje Canavarı, 30 Günlük Seri..."
              />
            </div>

            <div className="form-group">
              <label>Açıklama / Koşul Notu</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="2"
                placeholder="Örn: Toplamda 5 projeyi başarıyla tamamla."
              />
            </div>

            <div className="form-group">
              <label>Ödül / Motivasyon</label>
              <input
                type="text"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="Örn: Kendine güzel bir kahve ısmarla, 1 gün izin ver..."
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Kilit Açma Yöntemi</label>
                <select 
                  value={targetType} 
                  onChange={(e) => setTargetType(e.target.value)}
                >
                  <option value="manual">Manuel (Kendin Aç)</option>
                  <option value="projects_completed">Proje Tamamlama Sayısı</option>
                  <option value="goals_achieved">Hedefe Ulaşma Sayısı</option>
                  <option value="habit_streak">Alışkanlık Serisi (Gün)</option>
                </select>
              </div>

              {targetType !== 'manual' && (
                <div className="form-group">
                  <label>Hedef Değer</label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    required
                  />
                </div>
              )}
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary">Ekle</button>
          </div>
        </form>
      </div>
    </div>
  );
}
