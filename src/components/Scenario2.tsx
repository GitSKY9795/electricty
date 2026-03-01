import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format, parseISO, getYear, getMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MOCK_DATA } from '@/data/mockData';
import { useData } from '@/context/DataContext';

export default function Scenario2() {
  const { data: customData, isCustomData } = useData();
  const dataToUse = isCustomData ? customData : MOCK_DATA;

  // 1. Total Consumption by Region (2019 vs 2020)
  const regionData = useMemo(() => {
    const aggregated: Record<string, { region: string; 2019: number; 2020: number }> = {};

    dataToUse.forEach(record => {
      let date;
      try {
        date = parseISO(record.date);
      } catch (e) { return; }

      const year = getYear(date);
      const region = record.region;

      if (!aggregated[region]) {
        aggregated[region] = { region, 2019: 0, 2020: 0 };
      }
      
      if (year === 2019 || year === 2020) {
        aggregated[region][year] += record.consumption;
      }
    });

    return Object.values(aggregated).sort((a, b) => b[2019] - a[2019]);
  }, [dataToUse]);

  // 2. Heatmap Data: Region vs Month (Average Daily Consumption)
  // We'll focus on 2020 to show the lockdown dip across regions
  const heatmapData = useMemo(() => {
    const aggregated: Record<string, Record<string, { sum: number; count: number }>> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize structure
    Object.values(regionData).forEach((r: any) => {
      aggregated[r.region] = {};
      months.forEach(m => {
        aggregated[r.region][m] = { sum: 0, count: 0 };
      });
    });

    dataToUse.forEach(record => {
      let date;
      try {
        date = parseISO(record.date);
      } catch (e) { return; }

      const year = getYear(date);
      if (year !== 2020) return; // Focus on 2020 for heatmap

      const monthIndex = getMonth(date);
      const monthName = months[monthIndex];
      const region = record.region;

      if (aggregated[region] && aggregated[region][monthName]) {
        aggregated[region][monthName].sum += record.consumption;
        aggregated[region][monthName].count += 1;
      }
    });

    // Calculate averages
    const result: { region: string; data: { month: string; value: number }[] }[] = [];
    Object.entries(aggregated).forEach(([region, monthData]) => {
      const monthlyAvgs = months.map(m => ({
        month: m,
        value: monthData[m].count > 0 ? Math.round(monthData[m].sum / monthData[m].count) : 0
      }));
      result.push({ region, data: monthlyAvgs });
    });

    return result;
  }, [regionData]);

  // Find max value for heatmap scaling
  const maxHeatmapValue = useMemo(() => {
    let max = 0;
    heatmapData.forEach(r => r.data.forEach(d => {
      if (d.value > max) max = d.value;
    }));
    return max;
  }, [heatmapData]);

  // Color scale for heatmap
  const getHeatmapColor = (value: number) => {
    const intensity = value / maxHeatmapValue;
    // Blue scale
    return `rgba(59, 130, 246, ${Math.max(0.1, intensity)})`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regional Consumption Comparison (2019 vs 2020)</CardTitle>
          <CardDescription>
            Total electricity consumption by region. Western and Northern regions typically have the highest demand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="region" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value: number) => [value.toLocaleString() + ' MU', 'Consumption']}
                />
                <Legend />
                <Bar dataKey="2019" name="2019 Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="2020" name="2020 Total" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <h4 className="font-semibold text-sm mb-1">Regional Insight</h4>
            <p className="text-sm text-slate-600">
              The <strong>West</strong> and <strong>North</strong> regions, being industrial hubs, show the highest absolute consumption. 
              However, the lockdown impact (visible in the heatmap below) was widespread, affecting all regions with a notable dip in April 2020.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2020 Regional Demand Heatmap</CardTitle>
          <CardDescription>
            Average daily consumption by Region and Month in 2020. Darker blue indicates higher demand. 
            Notice the lighter shades in April/May across most regions (Lockdown effect).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header Row */}
              <div className="flex border-b border-slate-200 pb-2">
                <div className="w-32 font-medium text-slate-500 text-sm">Region</div>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                  <div key={m} className="flex-1 text-center text-xs font-medium text-slate-500">{m}</div>
                ))}
              </div>
              
              {/* Rows */}
              {heatmapData.map((row) => (
                <div key={row.region} className="flex items-center border-b border-slate-100 py-2">
                  <div className="w-32 font-medium text-slate-700 text-sm">{row.region}</div>
                  {row.data.map((cell) => (
                    <div key={cell.month} className="flex-1 flex justify-center p-1">
                      <div 
                        className="w-full h-8 rounded flex items-center justify-center text-[10px] text-slate-900 font-medium transition-all hover:scale-105 cursor-default"
                        style={{ backgroundColor: getHeatmapColor(cell.value) }}
                        title={`${row.region} - ${cell.month}: ${cell.value} MU/day avg`}
                      >
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
            <span>Low Demand</span>
            <div className="w-24 h-2 rounded bg-gradient-to-r from-blue-50 to-blue-600"></div>
            <span>High Demand</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
