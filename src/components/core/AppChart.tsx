import {
  BarChart,
  type BarChartProps,
  AreaChart,
  type AreaChartProps,
  DonutChart,
  type DonutChartProps,
} from "@mantine/charts";

export const AppChart = (p: BarChartProps) => (
  <BarChart h={220} gridAxis="y" tickLine="none" {...p} />
);

export const AppBarChart = (p: BarChartProps) => (
  <BarChart
    h={260}
    gridAxis="y"
    tickLine="none"
    maxBarWidth={34}
    barProps={{ radius: [6, 6, 0, 0] }}
    {...p}
  />
);

export const AppAreaChart = (p: AreaChartProps) => (
  <AreaChart
    h={260}
    gridAxis="y"
    tickLine="none"
    curveType="monotone"
    withGradient
    fillOpacity={0.2}
    strokeWidth={2.5}
    withDots
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
