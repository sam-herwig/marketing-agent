import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ErrorStatsProps {
  data: Record<string, Record<string, number>>;
}

export default function ErrorStats({ data }: ErrorStatsProps) {
  // Calculate total errors by category
  const categoryTotals = Object.entries(data).map(([category, services]) => {
    const total = Object.values(services).reduce((sum, count) => sum + count, 0);
    return { category, total, services };
  });

  // Sort by total errors
  categoryTotals.sort((a, b) => b.total - a.total);

  // Get top error categories for chart
  const chartData = categoryTotals.slice(0, 5).map(({ category, total }) => ({
    category: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    errors: total,
  }));

  const totalErrors = categoryTotals.reduce((sum, { total }) => sum + total, 0);

  return (
    <div className="space-y-4">
      {/* Error Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Errors (Last Hour)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalErrors}</p>
            {totalErrors > 50 && (
              <Alert className="mt-3" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  High error rate detected. Immediate attention required.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Error Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{categoryTotals.length}</p>
            <p className="text-sm text-gray-600 mt-1">
              Unique error categories detected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Error Categories</CardTitle>
          <CardDescription>Most frequent error types in the last hour</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="errors" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Error Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Error Details by Service</CardTitle>
          <CardDescription>Breakdown of errors by category and service</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryTotals.map(({ category, total, services }) => (
              <div key={category} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">
                    {category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <Badge variant={total > 10 ? 'destructive' : 'secondary'}>
                    {total} errors
                  </Badge>
                </div>
                <div className="space-y-1">
                  {Object.entries(services).map(([service, count]) => (
                    <div key={service} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{service}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}