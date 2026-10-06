// Shared "today" calculations for habits and routines (Home + Günlük Düzen pages)

export const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isoWeekday = (date) => (date.getDay() === 0 ? 7 : date.getDay());

export function habitsToday(habits = [], date = new Date()) {
  const dateStr = formatDateLocal(date);
  const weekday = isoWeekday(date);

  return habits
    .map((habit) => {
      let target;
      let required;
      if (habit.weekly_targets && habit.weekly_targets.length === 7) {
        target = habit.weekly_targets[weekday - 1] || 0;
        required = target > 0;
      } else {
        target = habit.target_count || 1;
        required = habit.frequency === 'custom' ? (habit.custom_days || []).includes(weekday) : true;
      }
      const log = (habit.logs || []).find(l => l.log_date === dateStr);
      const count = log ? log.count : 0;
      return { habit, dateStr, target, required, count, done: required && count >= target };
    })
    .filter(h => h.required);
}

export function dailyProgress(habits, routines) {
  const todayHabits = habitsToday(habits);
  const habitsDone = todayHabits.filter(h => h.done).length;
  const routinesDone = routines.filter(r => r.is_completed_today).length;
  const total = todayHabits.length + routines.length;
  const done = habitsDone + routinesDone;
  return {
    todayHabits,
    habitsDone,
    habitsTotal: todayHabits.length,
    routinesDone,
    routinesTotal: routines.length,
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0
  };
}
