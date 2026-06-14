import React, { useState, useEffect } from 'react';
import { BookOpen, Trash2, Calendar, Smile, Heart, Check } from 'lucide-react';

export default function JournalDashboard({
  entries = [],
  onSaveEntry,
  onDeleteEntry
}) {
  const [moodRating, setMoodRating] = useState(null);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  
  const tagsList = ['Verimli', 'Sakin', 'Yoğun', 'Mutlu', 'Yorgun', 'Sosyal', 'Sağlıklı', 'Eğlenceli'];

  // Check if today already has an entry to populate form
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.entry_date.split('T')[0] === todayStr);
    
    if (todayEntry) {
      setMoodRating(todayEntry.mood_rating);
      setContent(todayEntry.content || '');
      setSelectedTags(todayEntry.tags || []);
    } else {
      setMoodRating(null);
      setContent('');
      setSelectedTags([]);
    }
  }, [entries]);

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!moodRating && !content.trim()) {
      alert('Lütfen en azından bir ruh hali seçin veya günlük notu yazın!');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    onSaveEntry({
      entry_date: todayStr,
      mood_rating: moodRating,
      content: content.trim(),
      tags: selectedTags
    });
  };

  const getMoodEmoji = (rating) => {
    switch (rating) {
      case 1: return { emoji: '😢', label: 'Üzgün', class: 'active-1' };
      case 2: return { emoji: '😕', label: 'Keyifsiz', class: 'active-2' };
      case 3: return { emoji: '😐', label: 'Normal', class: 'active-3' };
      case 4: return { emoji: '🙂', label: 'İyi', class: 'active-4' };
      case 5: return { emoji: '😄', label: 'Harika', class: 'active-5' };
      default: return { emoji: '❓', label: 'Bilinmiyor', class: '' };
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="journal-split-layout">
      {/* Left Column: Log Today */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={18} style={{ color: 'var(--danger)' }} />
          Bugün Nasıl Hissediyorsun?
        </h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Mood Selection */}
          <div className="mood-select-container">
            <div className="mood-emoji-grid">
              {[1, 2, 3, 4, 5].map(rating => {
                const config = getMoodEmoji(rating);
                const isActive = moodRating === rating;
                return (
                  <button
                    type="button"
                    key={rating}
                    className={`mood-emoji-btn ${isActive ? config.class : ''}`}
                    onClick={() => setMoodRating(rating)}
                  >
                    <span>{config.emoji}</span>
                    <span className="mood-emoji-label">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diary Editor */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={13} style={{ color: 'var(--primary)' }} />
              Bugünün Hikayesi / Günlük Notu
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="5"
              placeholder="Bugün neler oldu? Seni ne mutlu etti veya ne zorladı? Düşüncelerini buraya dök..."
              style={{ fontSize: '14px', lineHeight: '1.5' }}
            />
          </div>

          {/* Tags Selector */}
          <div className="form-group">
            <label>Günün Etiketleri (Tags)</label>
            <div className="tag-badge-selector">
              {tagsList.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <span
                    key={tag}
                    className={`tag-selectable ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
            Günlüğü Kaydet
          </button>
        </form>
      </div>

      {/* Right Column: History Timeline */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} />
          Günlük Tarihçesi
        </h3>

        {entries.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <Smile style={{ width: '48px', height: '48px' }} />
            <h3>Henüz Kayıt Yok</h3>
            <p>Bugünün ruh halini ve notlarını girerek ilk günlük kaydını oluştur.</p>
          </div>
        ) : (
          <div className="timeline-container">
            {entries.map(entry => {
              const mood = getMoodEmoji(entry.mood_rating);
              return (
                <div key={entry.id} className="timeline-item">
                  <div className="timeline-card-wrapper glass-card">
                    <div className="timeline-header">
                      <span className="timeline-date-label">
                        {formatDate(entry.entry_date)}
                      </span>
                      {entry.mood_rating && (
                        <span 
                          className="timeline-mood-indicator" 
                          title={mood.label}
                        >
                          {mood.emoji}
                        </span>
                      )}
                    </div>

                    {entry.content && (
                      <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                        {entry.content}
                      </p>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="timeline-tags-row">
                        {entry.tags.map(t => (
                          <span key={t} className="timeline-tag">{t}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                      <button
                        className="btn-card-action delete"
                        onClick={() => onDeleteEntry(entry.id)}
                        title="Günlük Girişini Sil"
                        style={{ padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
