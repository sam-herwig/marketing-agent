import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CampaignMetricsProps {
  data: {
    total_campaigns: number;
    active_campaigns: number;
    execution_stats: Record<string, number>;
    success_rate: number;
  };
}

export default function CampaignMetrics({ data }: CampaignMetricsProps) {
  // Transform execution stats for pie chart
  const pieData = Object.entries(data.execution_stats).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  const COLORS = {
    Completed: '#10b981',
    Failed: '#ef4444',
    Running: '#3b82f6',
    Pending: '#f59e0b',
  };

  return (
    <div className="space-y-4">
      {/* Campaign Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.total_campaigns}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.active_campaigns}</p>
            <Progress
              value={(data.active_campaigns / data.total_campaigns) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.success_rate.toFixed(1)}%</p>
            <Progress value={data.success_rate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Execution Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Execution Status</CardTitle>
          <CardDescription>Distribution of campaign execution statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}