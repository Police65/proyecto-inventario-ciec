import React from 'react';
import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ChartDataItem } from '../../types'; 

interface AnomalyPieChartProps {
  data: ChartDataItem[]; 
  title?: string;
}

const COLORS = ['#EF4444', '#10B981']; // Rojo para anomalías, Verde para normales

const AnomalyPieChart: React.FC<AnomalyPieChartProps> = ({ data, title = "Distribución de Transacciones" }) => {
  if (!data || data.length === 0 || data.every(item => item.value === 0)) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de anomalías para mostrar en el gráfico.</p>;
  }
  
  return (
    <div className="w-full h-72 md:h-96"> 
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80} 
            fill="#8884d8" 
            dataKey="value"
            nameKey="name"
            label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '0.375rem', fontSize: '0.875rem', border: '1px solid #E5E7EB' }}
            itemStyle={{ color: '#1F2937' }}
            formatter={(value: number, name: string) => [`${value} transacciones`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AnomalyPieChart;