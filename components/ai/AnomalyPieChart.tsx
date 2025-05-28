
import React from 'react';
import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ChartDataItem } from '../../types'; // Use ChartDataItem from types.ts

interface AnomalyPieChartProps {
  data: ChartDataItem[]; // Expects data like [{ name: "Anomalías", value: 5 }, { name: "Normales", value: 95 }]
  title?: string;
}

const COLORS = ['#EF4444', '#10B981']; // Red for anomalies, Green for normal

const AnomalyPieChart: React.FC<AnomalyPieChartProps> = ({ data, title = "Distribución de Transacciones" }) => {
  if (!data || data.length === 0 || data.every(item => item.value === 0)) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de anomalías para mostrar.</p>;
  }
  
  return (
    <div className="w-full h-72 md:h-96"> {/* Responsive height */}
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80} // Adjust radius as needed
            fill="#8884d8" // Default fill, overridden by Cell
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.25rem', fontSize: '0.875rem' }}
            itemStyle={{ color: '#1F2937' }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AnomalyPieChart;
    