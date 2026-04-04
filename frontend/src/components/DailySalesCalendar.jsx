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
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
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
          <p className="font-serif text-3xl font-bold text-[#1A1A1A]">₹{totalRevenue.toLocaleString()}</p>
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
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const dayKey = getDayKey(day);
            const dayData = dailySalesMap[dayKey];
            const hasData = dayData && dayData.total > 0;
            const isToday = new Date().toISOString().split('T')[0] === dayKey;

            // Calculate percentage for walk-in vs online
            const walkInPercent = dayData?.total > 0 ? (dayData.walkIn / dayData.total) * 100 : 0;
            const onlinePercent = dayData?.total > 0 ? (dayData.online / dayData.total) * 100 : 0;

            return (
              <motion.div
                key={day}
                whileHover={hasData ? { scale: 1.05 } : {}}
                className={`aspect-square rounded-2xl border-2 p-3 flex flex-col justify-between transition-all cursor-pointer group ${
                  isToday
                    ? 'border-[#5A5A40] bg-[#5A5A40]/5'
                    : hasData
                    ? 'border-[#1A1A1A]/10 bg-white hover:border-[#5A5A40]/30'
                    : 'border-[#1A1A1A]/5 bg-[#F5F5F0]'
                }`}
              >
                {/* Day Number */}
                <div className={`text-sm font-bold ${isToday ? 'text-[#5A5A40]' : 'text-[#1A1A1A]'}`}>
                  {day}
                </div>

                {hasData ? (
                  <>
                    {/* Total Amount */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#1A1A1A] leading-tight">
                        ₹{(dayData.total / 1000).toFixed(0)}k
                      </p>

                      {/* Progress Bar showing Walk-in vs Online */}
                      <div className="flex gap-0.5 h-1 bg-[#E8E8DC] rounded-full overflow-hidden">
                        {walkInPercent > 0 && (
                          <div
                            className="bg-[#5A5A40] transition-all"
                            style={{ width: `${walkInPercent}%` }}
                            title={`Walk-in: ₹${dayData.walkIn.toLocaleString()}`}
                          />
                        )}
                        {onlinePercent > 0 && (
                          <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${onlinePercent}%` }}
                            title={`Online: ₹${dayData.online.toLocaleString()}`}
                          />
                        )}
                      </div>

                      {/* Breakdown - shown on hover */}
                      <div className="hidden group-hover:flex flex-col text-[8px] text-[#1A1A1A]/60">
                        {dayData.walkIn > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                            ₹{(dayData.walkIn / 1000).toFixed(1)}k walk-in
                          </span>
                        )}
                        {dayData.online > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            ₹{(dayData.online / 1000).toFixed(1)}k online
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-[#1A1A1A]/20">No sales</div>
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
