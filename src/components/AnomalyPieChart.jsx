import React from "react";
import { PieChart, Pie, Tooltip, Legend, Cell } from "recharts";

const COLORS = ["#FF4444", "#00C49F"];

const AnomalyPieChart = ({ data }) => {
  return (
    <div>
      <h3>Distribución de Anomalías</h3>
      <PieChart width={400} height={400}>
        <Pie
          data={data}
          cx={200}
          cy={200}
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  );
};

export default AnomalyPieChart;