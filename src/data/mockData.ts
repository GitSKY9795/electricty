import { addDays, format, getMonth, getYear, isSameMonth, parseISO, startOfMonth } from 'date-fns';

export interface ElectricityRecord {
  date: string;
  state: string;
  region: 'North' | 'South' | 'East' | 'West' | 'North East';
  consumption: number; // in MU (Million Units)
}

const STATES_BY_REGION = {
  North: ['Punjab', 'Haryana', 'Rajasthan', 'Delhi', 'Uttar Pradesh', 'Uttarakhand', 'Himachal Pradesh', 'Jammu & Kashmir', 'Chandigarh'],
  South: ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Puducherry'],
  East: ['Bihar', 'Odisha', 'West Bengal', 'Jharkhand'],
  West: ['Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Chhattisgarh', 'Goa'],
  'North East': ['Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura', 'Arunachal Pradesh', 'Sikkim']
};

// Base consumption values to make data realistic (approximate relative scale)
const BASE_CONSUMPTION: Record<string, number> = {
  'Maharashtra': 450, 'Gujarat': 350, 'Uttar Pradesh': 380, 'Tamil Nadu': 320,
  'Rajasthan': 250, 'Madhya Pradesh': 220, 'Karnataka': 240, 'Telangana': 180,
  'Andhra Pradesh': 190, 'West Bengal': 170, 'Bihar': 100, 'Punjab': 160,
  'Haryana': 150, 'Delhi': 110, 'Kerala': 80, 'Odisha': 90, 'Jharkhand': 70,
  'Chhattisgarh': 85, 'Assam': 30, 'Himachal Pradesh': 35, 'Uttarakhand': 40,
  'Jammu & Kashmir': 45, 'Goa': 15, 'Tripura': 8, 'Manipur': 5, 'Meghalaya': 6,
  'Nagaland': 4, 'Arunachal Pradesh': 3, 'Mizoram': 3, 'Sikkim': 2, 'Chandigarh': 5,
  'Puducherry': 8
};

export const generateData = (): ElectricityRecord[] => {
  const data: ElectricityRecord[] = [];
  const startDate = new Date('2019-01-01');
  const endDate = new Date('2020-12-05');
  let currentDate = startDate;

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const month = getMonth(currentDate); // 0-11
    const year = getYear(currentDate);

    // Seasonality factor: Peak in Summer (April-June: 3-5), Monsoon dip (July-Sept: 6-8), Winter dip (Dec-Jan: 11, 0)
    let seasonality = 1.0;
    if (month >= 3 && month <= 5) seasonality = 1.25; // Summer peak
    else if (month >= 6 && month <= 8) seasonality = 1.1; // Monsoon
    else if (month === 0 || month === 1 || month === 11) seasonality = 0.85; // Winter

    // Lockdown Impact: March 25 - May 31 2020
    // Severe drop in April 2020, recovering in May/June
    let lockdownFactor = 1.0;
    if (year === 2020) {
      if (month === 2 && currentDate.getDate() > 24) lockdownFactor = 0.75; // Late March
      if (month === 3) lockdownFactor = 0.70; // April (Deepest impact)
      if (month === 4) lockdownFactor = 0.85; // May (Recovery starts)
      if (month === 5) lockdownFactor = 0.95; // June (Near normal)
    }

    Object.entries(STATES_BY_REGION).forEach(([region, states]) => {
      states.forEach(state => {
        const base = BASE_CONSUMPTION[state] || 50;
        // Add some daily noise
        const noise = (Math.random() - 0.5) * 0.1 * base; 
        
        // Calculate final consumption
        let consumption = base * seasonality * lockdownFactor + noise;
        
        // Ensure strictly positive
        consumption = Math.max(consumption, 1);

        data.push({
          date: dateStr,
          state,
          region: region as any,
          consumption: parseFloat(consumption.toFixed(2))
        });
      });
    });

    currentDate = addDays(currentDate, 1);
  }

  return data;
};

export const MOCK_DATA = generateData();
