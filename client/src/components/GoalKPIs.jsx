import React from 'react';
import { Target, CheckCircle2, TrendingUp, Flame } from 'lucide-react';

export default function GoalKPIs({ goals = [] }) {
  const total = goals.length;
  const completed = goals.filter(g => g.is_completed || (g.progress_type === 'metric' && parseFloat(g.current_value) >= parseFloat(g.target_value))).length;
  const active = total - completed;
  
  const successRate = total > 0 
    ? Math.round((completed / total) * 100) 
    : 0;

  return (
    <section className="stats-section">
      {/* Total Goals */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Toplam Hedef</span>
          <div className="stat-icon-wrapper blue">
            <Target />
          </div>
        </div>
        <div className="stat-value">{total}</div>
        <div className="stat-desc">Kişisel hedefler ve alışkanlıklar</div>
      </div>

      {/* Completed Goals */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Tamamlananlar</span>
          <div className="stat-icon-wrapper emerald">
            <CheckCircle2 />
          </div>
        </div>
        <div className="stat-value">{completed}</div>
        <div className="stat-desc">Ulaşılan hedefler</div>
      </div>

      {/* Active Goals */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Devam Edenler</span>
          <div className="stat-icon-wrapper orange">
            <Flame />
          </div>
        </div>
        <div className="stat-value">{active}</div>
        <div className="stat-desc">İlerlemekte olan hedefler</div>
      </div>

      {/* Success Rate */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Başarı Oranı</span>
          <div className="stat-icon-wrapper violet">
            <TrendingUp />
          </div>
        </div>
        <div className="stat-value">{successRate}%</div>
        <div className="stat-progress-container">
          <div className="stat-progress-bar" style={{ width: `${successRate}%` }}></div>
        </div>
      </div>
    </section>
  );
}
