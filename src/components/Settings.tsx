import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Baby, Calendar, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { AppSettings } from '../types';
import { requestPermission, notificationsAvailable } from '../utils/notifications';
import { getBabyAgeLabel } from '../utils/sleepLogic';
import { format, parseISO } from 'date-fns';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function Settings({ settings, onSave }: SettingsProps) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }
  }, []);

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleNotificationsToggle = async () => {
    if (draft.notificationsEnabled) {
      // Turn off
      setDraft((d) => ({ ...d, notificationsEnabled: false }));
    } else {
      // Request permission
      if (notifPermission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser settings.');
        return;
      }
      const granted = await requestPermission();
      if (granted) {
        setNotifPermission('granted');
        setDraft((d) => ({ ...d, notificationsEnabled: true }));
      } else {
        setNotifPermission('denied');
      }
    }
  };

  const ageLabel = getBabyAgeLabel(draft.babyBirthdate);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-gradient-to-b from-primary-500 to-primary-600">
        <h1 className="text-white font-bold text-xl">Settings</h1>
        <p className="text-white/70 text-sm mt-0.5">Customize your experience</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Baby Profile */}
        <section>
          <SectionHeader icon={<Baby size={14} />} title="Baby Profile" />
          <div className="card divide-y divide-gray-50">
            {/* Name */}
            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Name
              </label>
              <input
                type="text"
                value={draft.babyName}
                onChange={(e) => setDraft((d) => ({ ...d, babyName: e.target.value }))}
                placeholder="Baby"
                className="input-field"
              />
            </div>

            {/* Birthdate */}
            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Birthdate
              </label>
              <input
                type="date"
                value={draft.babyBirthdate}
                onChange={(e) => setDraft((d) => ({ ...d, babyBirthdate: e.target.value }))}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="input-field"
              />
              {draft.babyBirthdate && (
                <p className="text-xs text-gray-400 mt-2">
                  Age: {ageLabel}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <SectionHeader icon={<Bell size={14} />} title="Notifications" />
          <div className="card divide-y divide-gray-50">
            {/* Master toggle */}
            <div className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold text-gray-800 text-sm">Push Notifications</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {notifPermission === 'denied'
                    ? 'Blocked in browser settings'
                    : notifPermission === 'unsupported'
                    ? 'Not supported on this device'
                    : notifPermission === 'granted'
                    ? 'Permission granted'
                    : 'Permission not yet requested'}
                </div>
              </div>
              <ToggleSwitch
                enabled={draft.notificationsEnabled}
                onChange={handleNotificationsToggle}
                disabled={notifPermission === 'denied' || notifPermission === 'unsupported'}
              />
            </div>

            {/* Permission warning */}
            {notifPermission === 'denied' && (
              <div className="px-4 py-3 flex items-start gap-2 bg-amber-50">
                <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Notifications are blocked. Enable them in your browser or OS settings to receive alerts.
                </p>
              </div>
            )}

            {/* Alert types — only show if notifications enabled */}
            {draft.notificationsEnabled && (
              <>
                <AlertToggle
                  label="Wake Window Alerts"
                  description="Notify when nap or bedtime is due"
                  enabled={draft.alerts.wakeWindow}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      alerts: { ...d.alerts, wakeWindow: v },
                    }))
                  }
                />
                <AlertToggle
                  label="Bedtime Reminder"
                  description="30 minutes before suggested bedtime"
                  enabled={draft.alerts.bedtime}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      alerts: { ...d.alerts, bedtime: v },
                    }))
                  }
                />
                <AlertToggle
                  label="Long Nap Alert"
                  description="Wake baby after 1h 45m nap"
                  enabled={draft.alerts.longNap}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      alerts: { ...d.alerts, longNap: v },
                    }))
                  }
                />
              </>
            )}
          </div>
        </section>

        {/* Sleep info card */}
        <section>
          <SectionHeader icon={<Calendar size={14} />} title="9-Month Sleep Guide" />
          <div className="card p-4 space-y-3">
            <InfoRow label="Total daily sleep" value="12–15 hours" />
            <InfoRow label="Night sleep" value="10–12 hours" />
            <InfoRow label="Naps per day" value="2 naps" />
            <InfoRow label="Wake window 1" value="2.5–3 hours" />
            <InfoRow label="Wake window 2" value="3–3.5 hours" />
            <InfoRow label="Wake window 3" value="3.5–4 hours" />
            <InfoRow label="Target bedtime" value="7:00 PM" />
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
          }`}
        >
          {saved ? (
            <>
              <Check size={18} />
              Saved!
            </>
          ) : (
            'Save Settings'
          )}
        </button>

        {/* App version */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-300">Baby Sleep Tracker v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
    </div>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-primary-500' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
          enabled ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface AlertToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}

function AlertToggle({ label, description, enabled, onChange }: AlertToggleProps) {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <ToggleSwitch enabled={enabled} onChange={() => onChange(!enabled)} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  );
}
