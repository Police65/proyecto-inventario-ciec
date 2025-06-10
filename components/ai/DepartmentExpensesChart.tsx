
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AISummaryStat } from '../../types'; // Assuming type for AI data

interface DepartmentExpensesChartProps {
  data: AISummaryStat[]; // Use AISummaryStat from types.ts
}

const DepartmentExpensesChart: React.FC<DepartmentExpensesChartProps> = ({ data }) => {
  const chartData = data.map(item => ({
    name: item.dept, // 'name' is typically used by Recharts for XAxis dataKey
    total: item.total,
    promedio: item.mean, // Optional: show mean as well
  }));

  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de gastos para mostrar.</p>;
  }

  return (
    <div className="w-full h-72 md:h-96"> {/* Responsive height */}
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3">Gastos por Departamento (Análisis IA)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} className="dark:stroke-gray-600"/>
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 10, fill: '#4B5563' }} 
            className="dark:fill-gray-400"
            interval={0} 
            angle={-30} 
            textAnchor="end"
            height={50} // Adjust height for angled labels
          />
          <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} className="dark:fill-gray-400" />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.25rem', fontSize: '0.875rem' }} 
            itemStyle={{ color: '#1F2937' }}
            cursor={{fill: 'rgba(0,0,0,0.05)'}}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
          <Bar dataKey="total" name="Gasto Total" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
          {/* <Bar dataKey="promedio" name="Gasto Promedio" fill="#10B981" radius={[4, 4, 0, 0]} /> */}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DepartmentExpensesChart;