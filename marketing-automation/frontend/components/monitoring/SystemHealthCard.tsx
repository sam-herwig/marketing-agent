import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SystemHealthCardProps {
  service: string;
  data: {
    status: string;
    error?: string;
  };
}

export default function SystemHealthCard({ service, data }: SystemHealthCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'unhealthy':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatServiceName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' ');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {formatServiceName(service)}
          {getStatusIcon(data.status)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant={getStatusVariant(data.status)} className="mb-2">
          {data.status.toUpperCase()}
        </Badge>
        {data.error && (
          <p className="text-sm text-red-600 mt-2">{data.error}</p>
        )}
      </CardContent>
    </Card>
  );
}