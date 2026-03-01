import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, BarChart2, TrendingUp, PieChart, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseCSV, cleanData, analyzeData, DatasetSummary } from '@/lib/csvUtils';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { useData, ElectricityRecord } from '@/context/DataContext';
import { parse, isValid, format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function CsvAnalyzer() {
  const { setData: setGlobalData } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [cleaningLog, setCleaningLog] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setAiReport('');

    try {
      const rawData = await parseCSV(selectedFile);
      const { cleanedData, log } = cleanData(rawData);
      const datasetSummary = analyzeData(cleanedData);
      
      setData(cleanedData);
      setCleaningLog(log);
      setSummary(datasetSummary);
      
      // Try to map to ElectricityRecord for global context
      try {
        const mappedData: ElectricityRecord[] = cleanedData.map(row => {
          // Auto-detect columns based on common names in the user's dataset
          const dateVal = row['Dates'] || row['Date'] || row['date'];
          const stateVal = row['States'] || row['State'] || row['state'];
          const regionVal = row['Regions'] || row['Region'] || row['region'];
          const usageVal = row['Usage'] || row['Consumption'] || row['usage'] || row['consumption'];

          let parsedDate = new Date().toISOString();
          if (dateVal) {
             // Handle dd/mm/yyyy
             const parsed = parse(dateVal, 'dd/MM/yyyy', new Date());
             if (isValid(parsed)) {
               parsedDate = format(parsed, 'yyyy-MM-dd');
             } else {
               // Try ISO
               const iso = new Date(dateVal);
               if (isValid(iso)) parsedDate = format(iso, 'yyyy-MM-dd');
             }
          }
          
          let normalizedRegion = regionVal;
          if (regionVal === 'NR') normalizedRegion = 'North';
          if (regionVal === 'SR') normalizedRegion = 'South';
          if (regionVal === 'ER') normalizedRegion = 'East';
          if (regionVal === 'WR') normalizedRegion = 'West';
          if (regionVal === 'NER') normalizedRegion = 'North East';

          return {
            date: parsedDate,
            state: stateVal || 'Unknown',
            region: normalizedRegion || 'Unknown',
            consumption: Number(usageVal) || 0
          };
        }).filter(d => d.consumption > 0); // Filter invalid

        if (mappedData.length > 0) {
          setGlobalData(mappedData);
          log.push(`Successfully mapped ${mappedData.length} rows to Dashboard format.`);
        }
      } catch (err) {
        console.warn("Could not map to global dashboard format", err);
      }

      // Trigger AI Analysis
      generateAiReport(datasetSummary, cleanedData.slice(0, 20)); 
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Error processing file. Please check the format.");
    } finally {
      setLoading(false);
    }
  };

  const generateAiReport = async (summary: DatasetSummary, sample: any[]) => {
    setAnalyzing(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const prompt = `
        Act as a professional data analyst. I have uploaded a dataset.
        
        Here is the dataset overview:
        - Rows: ${summary.rowCount}
        - Columns: ${summary.columnCount}
        - Column Stats: ${JSON.stringify(summary.columns.map(c => ({ name: c.name, type: c.type, mean: c.mean?.toFixed(2), unique: c.unique })))}
        
        Here is a sample of the data (first 20 rows):
        ${JSON.stringify(sample)}

        Please provide a comprehensive analysis report in Markdown format with the following sections:
        1. **Key Insights**: Identify important patterns, anomalies, or trends.
        2. **Visual Insights Recommendation**: Suggest what charts would be most useful (I will render generic ones, but tell me what to look for).
        3. **Predictions**: If there is time-series data, forecast future trends qualitatively. If not, predict potential correlations.
        4. **Recommendations**: Actionable advice based on the data.

        Keep it concise, professional, and easy to read.
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      setAiReport(result.text || "No analysis generated.");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAiReport("Failed to generate AI insights. Please check your API key or try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const renderVisualizations = () => {
    if (!summary) return null;

    // 1. Identify Numeric Columns for Correlation/Distribution
    const numericCols = summary.columns.filter(c => c.type === 'number');
    // 2. Identify Categorical Columns for Bar/Pie
    const categoryCols = summary.columns.filter(c => c.type === 'string' && c.unique < 20); // Low cardinality
    // 3. Identify Date Columns for Trends
    const dateCol = summary.columns.find(c => c.type === 'date' || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time'));

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categorical Distribution */}
        {categoryCols.slice(0, 2).map((col, idx) => {
          // Aggregate counts
          const counts: Record<string, number> = {};
          data.forEach(row => {
            const val = row[col.name];
            counts[val] = (counts[val] || 0) + 1;
          });
          const chartData = Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10

          return (
            <Card key={col.name}>
              <CardHeader>
                <CardTitle>Distribution by {col.name}</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} tickFormatter={(val) => val.toString().slice(0, 10)} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill={COLORS[idx % COLORS.length]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}

        {/* Numerical Trends (if date exists) */}
        {dateCol && numericCols.length > 0 && (
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Trends Over Time ({numericCols[0].name})</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.slice(0, 100)}> {/* Limit points for performance */}
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={dateCol.name} fontSize={12} tickFormatter={(val) => val.toString().slice(0, 10)} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={numericCols[0].name} stroke="#8884d8" dot={false} />
                  {numericCols[1] && <Line type="monotone" dataKey={numericCols[1].name} stroke="#82ca9d" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        
        {/* If no date, show numeric distribution (Histogram-ish) */}
        {!dateCol && numericCols.length > 0 && (
           <Card>
           <CardHeader>
             <CardTitle>Value Distribution: {numericCols[0].name}</CardTitle>
           </CardHeader>
           <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={data.slice(0, 100)}>
                 <CartesianGrid strokeDasharray="3 3" />
                 <XAxis dataKey={summary.columns[0].name} fontSize={12} />
                 <YAxis />
                 <Tooltip />
                 <Line type="monotone" dataKey={numericCols[0].name} stroke="#ff7300" dot={false} />
               </LineChart>
             </ResponsiveContainer>
           </CardContent>
         </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {!file && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-blue-100 p-4 rounded-full mb-4">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Upload your CSV file</h3>
            <p className="text-slate-500 mb-6 text-center max-w-md">
              Drag and drop or click to upload. We'll automatically inspect, clean, and analyze your data.
            </p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Select CSV File
            </button>
          </CardContent>
        </Card>
      )}

      {/* Analysis Dashboard */}
      {file && summary && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{file.name}</h2>
              <p className="text-slate-500 text-sm">
                {summary.rowCount} rows • {summary.columnCount} columns
              </p>
            </div>
            <button 
              onClick={() => { setFile(null); setData([]); setSummary(null); }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Upload Different File
            </button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="cleaning">Cleaning</TabsTrigger>
              <TabsTrigger value="visuals">Visuals</TabsTrigger>
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summary.columns.map((col) => (
                  <Card key={col.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex justify-between">
                        {col.name}
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{col.type}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Missing:</span>
                          <span className={col.missing > 0 ? "text-red-500 font-medium" : "text-green-600"}>
                            {col.missing}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Unique:</span>
                          <span>{col.unique}</span>
                        </div>
                        {col.mean !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Mean:</span>
                            <span>{col.mean.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {summary.columns.map(c => <th key={c.name} className="px-4 py-2 font-medium">{c.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.preview.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            {summary.columns.map(c => (
                              <td key={c.name} className="px-4 py-2 truncate max-w-[200px]">
                                {row[c.name]?.toString()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cleaning Tab */}
            <TabsContent value="cleaning">
              <Card>
                <CardHeader>
                  <CardTitle>Data Cleaning Log</CardTitle>
                  <CardDescription>Automated steps taken to prepare your data.</CardDescription>
                </CardHeader>
                <CardContent>
                  {cleaningLog.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={20} />
                      <span>Data appears clean! No automated fixes were needed.</span>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {cleaningLog.map((log, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle size={16} className="text-green-500 mt-0.5" />
                          <span>{log}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Visuals Tab */}
            <TabsContent value="visuals" className="space-y-4">
              {renderVisualizations()}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="text-blue-600" />
                    AI-Generated Analysis
                  </CardTitle>
                  <CardDescription>
                    Insights powered by Gemini 3 Flash
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyzing ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-slate-500">Analyzing data patterns...</p>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-600">
                      <ReactMarkdown>{aiReport}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
