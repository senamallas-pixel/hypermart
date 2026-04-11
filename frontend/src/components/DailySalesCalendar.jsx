import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar, Truck, Store } from 'lucide-react';

export default function DailySalesCalendar({ analytics }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Sample data structure: analytics.monthly_daily_sales should have all days of the month
  const dailySalesMap = useMemo(() => {
    const map = {};
    if (analytics?.monthly_daily_sales) {
      analytics.monthly_daily_sales.forEach(day => {
        const dateKey = day.date;
        map[dateKey] = {
          total: day.revenue || 0,
          walkIn: day.walk_in || 0,
          online: day.online || 0,
          orders: day.orders || 0,
        };
      });
    }
    return map;
  }, [analytics]);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getDayKey = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toISOString().split('T')[0];
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const monthName = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get total for display
  const totalRevenue = Object.values(dailySalesMap).reduce((sum, day) => sum + (day.total || 0), 0);
  const totalWalkIn = Object.values(dailySalesMap).reduce((sum, day) => sum + (day.walkIn || 0), 0);
  const totalOnline = Object.values(dailySalesMap).reduce((sum, day) => sum + (day.online || 0), 0);

  // Create calendar grid
  const days = [];
  
  // Previous month cells
  const prevMonthDays = getDaysInMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: null });
  }
  
  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    const dateKey = getDayKey(i);
    days.push({ day: i, isCurrentMonth: true, date: dateKey });
  }

  // Next month cells to fill grid (always 42 cells or just enough to complete the week?)
  // 6 rows * 7 days = 42 cells length
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ day: i, isCurrentMonth: false, date: null });
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-[#5A5A40]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40">Total Revenue</p>
          </div>
          <p className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">₹{totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Store size={18} className="text-[#5A5A40]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40">Walk-in Sales</p>
          </div>
          <p className="font-serif text-3xl font-bold text-[#5A5A40]">₹{totalWalkIn.toLocaleString()}</p>
          <p className="text-xs text-[#1A1A1A]/40 mt-1">
            {totalRevenue > 0 ? ((totalWalkIn / totalRevenue) * 100).toFixed(0) : 0}% of total
          </p>
        </div>

        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={18} className="text-[#5A5A40]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40">Online Sales</p>
          </div>
          <p className="font-serif text-3xl font-bold text-[#5A5A40]">₹{totalOnline.toLocaleString()}</p>
          <p className="text-xs text-[#1A1A1A]/40 mt-1">
            {totalRevenue > 0 ? ((totalOnline / totalRevenue) * 100).toFixed(0) : 0}% of total
          </p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-2xl font-bold">{monthName}</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={20} className="text-[#5A5A40]" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#5A5A40] border border-[#5A5A40]/30 rounded-lg hover:bg-[#5A5A40]/5 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
              title="Next month"
            >
              <ChevronRight size={20} className="text-[#5A5A40]" />
            </button>
          </div>
        </div>

        {/* Day Labels */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayLabels.map(day => (
            <div key={day} className="text-center text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-[2px] bg-[#1A1A1A]/5 rounded-2xl overflow-hidden border border-[#1A1A1A]/10">
          {days.map((cell, idx) => {
            const isCurrentMonth = cell.isCurrentMonth;
            const dayKey = cell.date;

            const dayData = isCurrentMonth ? dailySalesMap[dayKey] : null;
            const hasData = dayData && dayData.total > 0;
            const isToday = isCurrentMonth && new Date().toISOString().split('T')[0] === dayKey;

            // Calculate percentage for walk-in vs online
            const walkInPercent = dayData?.total > 0 ? (dayData.walkIn / dayData.total) * 100 : 0;
            const onlinePercent = dayData?.total > 0 ? (dayData.online / dayData.total) * 100 : 0;

            return (
              <motion.div
                key={`day-${idx}-${cell.day}`}
                whileHover={hasData ? { scale: 1.02, zIndex: 10 } : {}}
                className={`bg-white min-h-[70px] sm:min-h-[100px] p-2 sm:p-3 flex flex-col justify-between transition-all relative group ${
                  isToday
                    ? 'ring-2 ring-inset ring-[#5A5A40]'
                    : ''
                }`}
              >
                {/* Day Number */}
                <div className={`text-sm font-semibold transition-colors ${
                  isToday ? 'text-[#5A5A40]' : isCurrentMonth ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]/30 font-medium'
                }`}>
                  {cell.day}
                </div>

                {hasData && isCurrentMonth ? (
                  <div className="space-y-2 select-none">
                    {/* Total Amount */}
                    <div>
                      <p className="text-xs font-bold text-[#1A1A1A]">
                        ₹{(dayData.total / 1000).toFixed(1)}k
                      </p>

                      {/* Progress Bar showing Walk-in vs Online */}
                      <div className="flex gap-0.5 h-1.5 mt-1 bg-[#E8E8DC] rounded-full overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
                        {walkInPercent > 0 && (
                          <div
                            className="bg-[#5A5A40] transition-all"
                            style={{ width: `${walkInPercent}%` }}
                          />
                        )}
                        {onlinePercent > 0 && (
                          <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${onlinePercent}%` }}
                          />
                        )}
                      </div>

                      {/* Hover Tooltip */}
                      <div className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-max max-w-[140px] bg-[#1A1A1A] text-white text-[10px] p-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-2xl z-20 pointer-events-none">
                        <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-white/10 gap-3">
                          <span className="font-medium text-white/50">{new Date(dayKey).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                          <span className="font-bold text-[11px]">₹{dayData.total.toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          {dayData.walkIn > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-white/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E8E8DC]" /> Walk-in
                              </span>
                              <span className="font-medium">₹{dayData.walkIn.toLocaleString()}</span>
                            </div>
                          )}
                          {dayData.online > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-white/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Online
                              </span>
                              <span className="font-medium">₹{dayData.online.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {/* Tooltip Arrow */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1A1A1A] rotate-45 border-r border-b border-white/5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-auto text-[10px] uppercase font-bold tracking-widest transition-opacity ${
                    isCurrentMonth ? 'text-[#1A1A1A]/10 group-hover:text-[#1A1A1A]/30' : 'opacity-0'
                  }`}>
                    No sales
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#5A5A40]" />
            <span className="text-[#1A1A1A]/60">Walk-in Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[#1A1A1A]/60">Online Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-[#5A5A40]" />
            <span className="text-[#1A1A1A]/60">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
