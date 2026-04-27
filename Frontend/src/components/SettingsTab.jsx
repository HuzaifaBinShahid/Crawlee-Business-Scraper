import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { SectionHeading } from './SectionHeading';
import { NumberInput } from './NumberInput';
import { TextArea } from './TextArea';
import { CountriesAdmin } from './CountriesAdmin';
import { getSettings, updateSettings } from '../api/client';

export function SettingsTab() {
  const [settings, setSettings] = useState({
    minDelay: 2000, maxDelay: 5000, navTimeout: 90, maxRetries: 0, proxies: [], proxiesText: '',
  });
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => setSettings({ ...s, proxiesText: (s.proxies || []).join('\n') }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setError(null);
    const proxies = (settings.proxiesText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const toSave = {
      minDelay: Number(settings.minDelay) || 2000,
      maxDelay: Number(settings.maxDelay) || 5000,
      navTimeout: Number(settings.navTimeout) || 90,
      maxRetries: Number(settings.maxRetries) || 0,
      proxies,
    };
    updateSettings(toSave)
      .then(() => setSavedAt(Date.now()))
      .catch((err) => setError(err.message));
  };

  if (loading) return <div className="p-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="py-8 px-6 md:px-8 animate-fade-in">
      <SectionHeading
        eyebrow="System · Settings"
        title="Default Settings"
        subtitle="Starting values for new scrape runs. You can still override per run."
      />
      <div className="max-w-xl mb-6">
        <CountriesAdmin />
      </div>
      <div className="max-w-xl">
        <Card>
          <div data-testid="settings-form" className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Min Delay"
                hint="ms"
                min={500}
                step={100}
                value={settings.minDelay}
                onChange={(v) => setSettings((s) => ({ ...s, minDelay: v }))}
                data-testid="input-min-delay"
              />
              <NumberInput
                label="Max Delay"
                hint="ms"
                min={1000}
                step={100}
                value={settings.maxDelay}
                onChange={(v) => setSettings((s) => ({ ...s, maxDelay: v }))}
                data-testid="input-max-delay"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Navigation Timeout"
                hint="seconds"
                min={15}
                value={settings.navTimeout}
                onChange={(v) => setSettings((s) => ({ ...s, navTimeout: v }))}
                data-testid="input-nav-timeout"
              />
              <NumberInput
                label="Max Retries"
                hint="per request"
                min={0}
                max={5}
                value={settings.maxRetries}
                onChange={(v) => setSettings((s) => ({ ...s, maxRetries: v }))}
                data-testid="input-max-retries"
              />
            </div>

            <TextArea
              label="Default Proxies"
              hint="one per line, optional"
              value={settings.proxiesText || ''}
              onChange={(v) => setSettings((s) => ({ ...s, proxiesText: v }))}
              placeholder="http://user:pass@host:port"
              rows={4}
              mono
              data-testid="input-proxies"
            />

            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <Button onClick={handleSave} data-testid="save-settings">
                <Save className="w-4 h-4" />
                Save Settings
              </Button>
              {savedAt && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
              {error && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
