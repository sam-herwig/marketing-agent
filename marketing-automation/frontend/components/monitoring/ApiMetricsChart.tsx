'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ApiMetricsChartProps {
  data: {
    response_times: Record<string, any>;
    request_counts: Record<string, number>;
    error_rates: Record<string, number>;
  };
}

export default function ApiMetricsChart({ data }: ApiMetricsChartProps) {
  // Transform data for charts
  const chartData = Object.entries(data.response_times).map(([endpoint, times]) => ({
    endpoint: endpoint.split('/').pop() || endpoint,
    avgTime: times.avg,
    minTime: times.min,
    maxTime: times.max,
    requests: data.request_counts[endpoint] || 0,
    errorRate: data.error_rates[endpoint] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Response Times Chart */}
      <Card>
        <CardHeader>
          <CardTitle>API Response Times</CardTitle>
          <CardDescription>Average response time by endpoint (ms)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgTime" fill="var(--chart-primary)" name="Avg Time (ms)" />
              <Bar dataKey="maxTime" fill="var(--chart-secondary)" name="Max Time (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Request Volume and Error Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>Total requests by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="requests" fill="var(--chart-tertiary)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rates</CardTitle>
            <CardDescription>Error percentage by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.map((item) => (
                <div key={item.endpoint} className="flex items-center justify-between">
                  <span className="text-[var(--font-size-sm)] font-[var(--font-weight-medium)]">{item.endpoint}</span>
                  <Badge
                    variant={item.errorRate > 5 ? 'destructive' : item.errorRate > 0 ? 'secondary' : 'default'}
                  >
                    {item.errorRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}