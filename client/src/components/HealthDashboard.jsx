import { useState } from 'react';
import { Dumbbell, Apple } from 'lucide-react';
import WorkoutView from './WorkoutView';
import NutritionView from './NutritionView';

// Sağlık: two sections, remembered between visits
export default function HealthDashboard() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('health_tab') === 'food' ? 'food' : 'sport'; } catch { return 'sport'; }
  });
  const choose = (t) => {
    setTab(t);
    try { localStorage.setItem('health_tab', t); } catch { /* private mode */ }
  };

  return (
    <div className="health-page">
      <div className="health-tabs">
        <button type="button" className={tab === 'sport' ? 'on' : ''} onClick={() => choose('sport')}><Dumbbell size={18} /> Spor</button>
        <button type="button" className={tab === 'food' ? 'on' : ''} onClick={() => choose('food')}><Apple size={18} /> Beslenme</button>
      </div>
      {tab === 'sport' ? <WorkoutView /> : <NutritionView />}
    </div>
  );
}
