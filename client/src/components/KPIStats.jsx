import React from 'react';
import { FolderKanban, User, Briefcase, TrendingUp } from 'lucide-react';

export default function KPIStats({ projects = [] }) {
  const total = projects.length;
  const personal = projects.filter(p => p.type === 'personal').length;
  const external = projects.filter(p => p.type === 'external').length;
  
  const avgProgress = total > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / total) 
    : 0;

  return (
    <section className="stats-section">
      {/* Total Projects */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Toplam Proje</span>
          <div className="stat-icon-wrapper blue">
            <FolderKanban />
          </div>
        </div>
        <div className="stat-value">{total}</div>
        <div className="stat-desc">Aktif takip edilen projeler</div>
      </div>

      {/* Personal Projects */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Kişisel Projeler</span>
          <div className="stat-icon-wrapper violet">
            <User />
          </div>
        </div>
        <div className="stat-value">{personal}</div>
        <div className="stat-desc">Bireysel gelişim & hobiler</div>
      </div>

      {/* External Projects */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Dış Projeler</span>
          <div className="stat-icon-wrapper emerald">
            <Briefcase />
          </div>
        </div>
        <div className="stat-value">{external}</div>
        <div className="stat-desc">Müşteri & iş projeleri</div>
      </div>

      {/* Average Progress */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Ortalama İlerleme</span>
          <div className="stat-icon-wrapper orange">
            <TrendingUp />
          </div>
        </div>
        <div className="stat-value">{avgProgress}%</div>
        <div className="stat-progress-container">
          <div className="stat-progress-bar" style={{ width: `${avgProgress}%` }}></div>
        </div>
      </div>
    </section>
  );
}
