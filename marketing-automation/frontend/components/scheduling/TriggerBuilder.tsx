'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, Zap, GitBranch, AlertCircle } from 'lucide-react';

export default function TriggerBuilder() {
  const { data: session } = useSession();
  const [triggerType, setTriggerType] = useState('scheduled');
  const [config, setConfig] = useState<any>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateTrigger = async () => {
    try {
      const response = await fetch('/api/scheduling/triggers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ ...config, type: triggerType }),
      });

      const data = await response.json();
      setValidationErrors(data.errors || []);
      return data.valid;
    } catch (error) {
      console.error('Error validating trigger:', error);
      return false;
    }
  };

  const createTrigger = async () => {
    const isValid = await validateTrigger();
    if (!isValid) {
      return;
    }

    // In a real implementation, this would save the trigger configuration
    alert('Trigger created successfully!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trigger Configuration Builder</CardTitle>
        <CardDescription>Create and test trigger configurations for your campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={triggerType} onValueChange={setTriggerType}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scheduled">
              <Calendar className="h-4 w-4 mr-2" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="recurring">
              <Clock className="h-4 w-4 mr-2" />
              Recurring
            </TabsTrigger>
            <TabsTrigger value="event">
              <Zap className="h-4 w-4 mr-2" />
              Event
            </TabsTrigger>
            <TabsTrigger value="condition">
              <GitBranch className="h-4 w-4 mr-2" />
              Conditional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="run-at">Run Date & Time</Label>
              <Input
                id="run-at"
                type="datetime-local"
                onChange={(e) => setConfig({ ...config, run_at: e.target.value })}
              />
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] mt-1">
                Schedule a one-time execution at a specific date and time
              </p>
            </div>
          </TabsContent>

          <TabsContent value="recurring" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="interval-type">Interval Type</Label>
              <select
                id="interval-type"
                className="w-full px-[calc(var(--spacing-xs)*1.5)] py-[var(--spacing-xs)] border theme-border theme-radius-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={config.interval_type || ''}
                onChange={(e) => setConfig({ ...config, interval_type: e.target.value })}
              >
                <option value="">Select interval type</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="cron">Cron Expression</option>
              </select>
            </div>

            {config.interval_type === 'cron' ? (
              <div>
                <Label htmlFor="cron-expression">Cron Expression</Label>
                <Input
                  id="cron-expression"
                  placeholder="0 0 * * *"
                  onChange={(e) => setConfig({ ...config, cron_expression: e.target.value })}
                />
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] mt-1">
                  Enter a cron expression for advanced scheduling
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="interval-value">Interval Value</Label>
                <Input
                  id="interval-value"
                  type="number"
                  min="1"
                  placeholder="1"
                  onChange={(e) => setConfig({ ...config, interval_value: parseInt(e.target.value) })}
                />
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] mt-1">
                  How often to run (in {config.interval_type || 'selected units'})
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date (Optional)</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date (Optional)</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="event" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                placeholder="order_completed"
                onChange={(e) => setConfig({ ...config, event_name: e.target.value })}
              />
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] mt-1">
                Unique identifier for the event that will trigger the campaign
              </p>
            </div>

            <div>
              <Label htmlFor="webhook-url">Webhook URL (Optional)</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
              />
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] mt-1">
                External webhook that will send the event
              </p>
            </div>
          </TabsContent>

          <TabsContent value="condition" className="space-y-4 mt-4">
            <div>
              <Label>Condition Type</Label>
              <select
                className="w-full px-[calc(var(--spacing-xs)*1.5)] py-[var(--spacing-xs)] border theme-border theme-radius-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={config.conditions?.[0]?.type || ''}
                onChange={(e) => setConfig({
                  ...config,
                  conditions: [{
                    type: e.target.value,
                    ...config.conditions?.[0]
                  }]
                })}
              >
                <option value="">Select condition type</option>
                <option value="metric_threshold">Metric Threshold</option>
                <option value="time_window">Time Window</option>
                <option value="external_event">External Event</option>
              </select>
            </div>

            {config.conditions?.[0]?.type === 'metric_threshold' && (
              <>
                <div>
                  <Label htmlFor="metric">Metric Name</Label>
                  <Input
                    id="metric"
                    placeholder="conversion_rate"
                    onChange={(e) => setConfig({
                      ...config,
                      conditions: [{
                        ...config.conditions[0],
                        metric: e.target.value
                      }]
                    })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="operator">Operator</Label>
                    <select
                      id="operator"
                      className="w-full px-[calc(var(--spacing-xs)*1.5)] py-[var(--spacing-xs)] border theme-border theme-radius-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      value={config.conditions?.[0]?.operator || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        conditions: [{
                          ...config.conditions[0],
                          operator: e.target.value
                        }]
                      })}
                    >
                      <option value="">Select operator</option>
                      <option value="gte">Greater than or equal</option>
                      <option value="lte">Less than or equal</option>
                      <option value="eq">Equal to</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="threshold">Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      placeholder="0"
                      onChange={(e) => setConfig({
                        ...config,
                        conditions: [{
                          ...config.conditions[0],
                          threshold: parseFloat(e.target.value)
                        }]
                      })}
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {validationErrors.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end space-x-4 mt-6">
          <Button variant="outline" onClick={validateTrigger}>
            Validate
          </Button>
          <Button onClick={createTrigger}>
            Create Trigger
          </Button>
        </div>

        {/* Preview */}
        <div className="mt-[var(--spacing-md)] p-[var(--spacing-sm)] bg-[var(--color-surface)] theme-radius-md">
          <h4 className="font-[var(--font-weight-medium)] mb-[calc(var(--spacing-xs)*0.5)]">Configuration Preview</h4>
          <pre className="text-[var(--font-size-sm)] text-[var(--color-text-subtle)] overflow-auto">
            {JSON.stringify({ type: triggerType, ...config }, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}