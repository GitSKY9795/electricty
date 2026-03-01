import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Scenario1 from '@/components/Scenario1';
import Scenario2 from '@/components/Scenario2';
import CsvAnalyzer from '@/components/CsvAnalyzer';
import { Zap, FileText } from 'lucide-react';
import { DataProvider } from '@/context/DataContext';

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Zap size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">India Electricity Analysis</h1>
              <p className="text-xs text-slate-500">Jan 2019 – Dec 2020 • COVID-19 Impact Study</p>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            Data Source: Simulated Dataset
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="scenario1" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
              <p className="text-slate-500">Analyze consumption trends and regional variations.</p>
            </div>
            <TabsList className="grid w-full sm:w-auto grid-cols-3">
              <TabsTrigger value="scenario1">National Trends</TabsTrigger>
              <TabsTrigger value="scenario2">Regional Analysis</TabsTrigger>
              <TabsTrigger value="csv-analysis" className="flex items-center gap-2">
                <FileText size={14} />
                CSV Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="scenario1" className="space-y-4">
            <Scenario1 />
          </TabsContent>

          <TabsContent value="scenario2" className="space-y-4">
            <Scenario2 />
          </TabsContent>

          <TabsContent value="csv-analysis" className="space-y-4">
            <CsvAnalyzer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
