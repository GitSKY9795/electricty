import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { format, parseISO, getMonth, getYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MOCK_DATA } from '@/data/mockData';
import { useData } from '@/context/DataContext';

export default function Scenario1() {
  const { data: customData, isCustomData } = useData();
  const dataToUse = isCustomData ? customData : MOCK_DATA;

  // Aggregate monthly consumption for India
  const monthlyData = useMemo(() => {
    const aggregated: Record<string, { month: string; year: number; monthIndex: number; consumption: number }> = {};

    dataToUse.forEach(record => {
      let date;
      try {
        date = parseISO(record.date);
      } catch (e) { return; }
      
      const monthKey = format(date, 'yyyy-MM');
      
      if (!aggregated[monthKey]) {
        aggregated[monthKey] = {
          month: format(date, 'MMM'),
          year: getYear(date),
          monthIndex: getMonth(date),
          consumption: 0
        };
      }
      aggregated[monthKey].consumption += record.consumption;
    });

    // Transform into array for chart: [{ month: 'Jan', 2019: 1200, 2020: 1300 }]
    const chartDataMap: Record<string, any> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    months.forEach((m, i) => {
      chartDataMap[m] = { name: m, index: i };
    });

    Object.values(aggregated).forEach(entry => {
      if (chartDataMap[entry.month]) {
        chartDataMap[entry.month][entry.year] = Math.round(entry.consumption);
      }
    });

    return Object.values(chartDataMap).sort((a, b) => a.index - b.index);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const data2019 = monthlyData.map(d => d[2019] || 0);
    const data2020 = monthlyData.map(d => d[2020] || 0);
    
    // Lockdown months: April (3), May (4)
    // Compare April 2019 vs April 2020
    const aprilData = monthlyData[3];
    const april2019 = aprilData ? (aprilData[2019] || 0) : 0;
    const april2020 = aprilData ? (aprilData[2020] || 0) : 0;
    const dropPercentage = april2019 > 0 ? ((april2019 - april2020) / april2019 * 100).toFixed(1) : '0.0';

    // Find min/max
    let min = { val: Infinity, month: '', year: 0 };
    let max = { val: -Infinity, month: '', year: 0 };

    monthlyData.forEach(d => {
      if (d[2019] > max.val) max = { val: d[2019], month: d.name, year: 2019 };
      if (d[2020] > max.val) max = { val: d[2020], month: d.name, year: 2020 };
      
      if (d[2019] < min.val && d[2019] > 0) min = { val: d[2019], month: d.name, year: 2019 };
      if (d[2020] < min.val && d[2020] > 0) min = { val: d[2020], month: d.name, year: 2020 };
    });

    return {
      dropPercentage,
      april2019,
      april2020,
      min,
      max
    };
  }, [monthlyData]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lockdown Impact (April)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{stats.dropPercentage}%</div>
            <p className="text-xs text-slate-500">Year-over-Year decline in April 2020</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Peak Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.max.val.toLocaleString()} MU</div>
            <p className="text-xs text-slate-500">{stats.max.month} {stats.max.year}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lowest Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.min.val.toLocaleString()} MU</div>
            <p className="text-xs text-slate-500">{stats.min.month} {stats.min.year}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">April 2020 Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.april2020.toLocaleString()} MU</div>
            <p className="text-xs text-slate-500">During strict lockdown</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>National Electricity Consumption Trends (2019 vs 2020)</CardTitle>
          <CardDescription>
            Comparison of monthly aggregate consumption. Note the significant divergence starting in March 2020 due to the national lockdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value / 1000}k`} 
                  label={{ value: 'Consumption (MU)', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [value.toLocaleString() + ' MU', 'Consumption']}
                />
                <Legend />
                
                {/* Lockdown Highlight Area (March to May) */}
                {/* @ts-ignore */}
                <ReferenceArea x1="Mar" x2="May" fill="#fee2e2" fillOpacity={0.5} stroke="none" />
                
                <Line 
                  type="monotone" 
                  dataKey="2019" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#3b82f6' }} 
                  activeDot={{ r: 6 }}
                  name="2019 (Baseline)"
                />
                <Line 
                  type="monotone" 
                  dataKey="2020" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#ef4444' }} 
                  activeDot={{ r: 6 }}
                  name="2020 (Pandemic)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
            <span>Highlighted area indicates the strict lockdown phase (March - May 2020)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
