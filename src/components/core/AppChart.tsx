import {
  BarChart,
  type BarChartProps,
  AreaChart,
  type AreaChartProps,
  DonutChart,
  type DonutChartProps,
} from "@mantine/charts";

export const AppChart = (p: BarChartProps) => (
  <BarChart h={220} gridAxis="x" tickLine="none" {...p} />
);

export const AppBarChart = (p: BarChartProps) => (
  <BarChart
    h={250}
    gridAxis="x"
    tickLine="none"
    maxBarWidth={30}
    barProps={{ radius: [6, 6, 0, 0] }}
    {...p}
  />
);

export const AppAreaChart = (p: AreaChartProps) => (
  <AreaChart
    h={250}
    gridAxis="x"
    tickLine="none"
    curveType="monotone"
    withGradient
    fillOpacity={0.25}
    strokeWidth={2.5}
    {...p}
  />
);

export const AppDonutChart = (p: DonutChartProps) => (
  <DonutChart
    size={210}
    thickness={26}
    paddingAngle={4}
    withTooltip
    tooltipDataSource="segment"
    {...p}
  />
);
