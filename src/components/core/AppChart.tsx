import { BarChart, type BarChartProps } from "@mantine/charts";

export const AppChart = (p: BarChartProps) => (
  <BarChart h={220} gridAxis="y" tickLine="none" {...p} />
);
