import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const DepartmentExpensesChart = ({ data }) => {
  const chartData = data.map((item) => ({
    dept: item.dept,
    total: item.total,
  }));

  return (
    <div>
      <h3>Gastos por Departamento</h3>
      <BarChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dept" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" fill="#8884d8" />
      </BarChart>
    </div>
  );
};

export default DepartmentExpensesChart;