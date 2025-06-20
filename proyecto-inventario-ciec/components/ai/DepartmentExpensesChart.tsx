
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AISummaryStat } from '../../types'; 

interface DepartmentExpensesChartProps {
  data: AISummaryStat[]; 
}

const DepartmentExpensesChart: React.FC<DepartmentExpensesChartProps> = ({ data }) => {
  const chartData = data.map(item => ({
    name: item.dept, 
    total: item.total,
    // promedio: item.mean, // Opcional: mostrar también el promedio
  }));

  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de gastos para mostrar en el gráfico.</p>;
  }

  return (
    <div className="w-full h-72 md:h-96"> 
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3">Gastos por Departamento</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 50 }}> {/* Margen inferior aumentado para etiquetas */}
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} className="dark:stroke-gray-600"/>
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 10, fill: '#4B5563' }} 
            className="dark:fill-gray-400"
            interval={0} 
            angle={-40} // Etiquetas anguladas
            textAnchor="end" // Anclar al final para un mejor ajuste
            dy={10} // Ajustar posición vertical
          />
          <YAxis 
            tick={{ fontSize: 10, fill: '#4B5563' }} 
            className="dark:fill-gray-400" 
            tickFormatter={(value) => new Intl.NumberFormat('es-VE', { notation: 'compact', compactDisplay: 'short' }).format(value)} // Formato compacto
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '0.375rem', fontSize: '0.875rem', border: '1px solid #E5E7EB' }} 
            itemStyle={{ color: '#1F2937' }}
            cursor={{fill: 'rgba(0,0,0,0.05)'}}
            formatter={(value: number) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(value)}
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