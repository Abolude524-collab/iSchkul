import React, { useEffect, useState } from 'react';
import { applyThemePreference, SETTINGS_STORAGE_KEY } from '../services/theme';
import { Palette, MessageCircle, Bell, Lock, Database } from 'lucide-react';
import { Navbar } from '../components/Navbar';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  timeFormat: '12h' | '24h';
  mediaAutoplay: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  soundEnabled: boolean;
  autoDownloadMedia: 'wifi' | 'always' | 'never';
  pushNotifications: boolean;
  notificationTone: string;
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
}

const defaultSettings: SettingsState = {
  theme: 'light',
  fontSize: 'medium',
  language: 'en',
  timeFormat: '12h',
  mediaAutoplay: true,
  readReceipts: true,
  typingIndicators: true,
  soundEnabled: true,
  autoDownloadMedia: 'wifi',
  pushNotifications: true,
  notificationTone: 'default',
  lastSeen: 'everyone',
  profilePhotoVisibility: 'everyone',
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = { ...defaultSettings, ...JSON.parse(raw) } as SettingsState;
        setSettings(parsed);
        applyThemePreference(parsed.theme);
      }
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    applyThemePreference(settings.theme);
  }, [settings.theme]);

  const update = (patch: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      if (patch.theme) {
        applyThemePreference(patch.theme);
      }
      return next;
    });
  };

  const toggleSetting = (key: keyof SettingsState) => {
    const currentValue = settings[key];
    if (typeof currentValue === 'boolean') {
      update({ [key]: !currentValue } as Partial<SettingsState>);
    }
  };

  const renderGeneralSettings = () => (
    <div className="animate-fadein">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        General Preferences
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Theme</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose your preferred appearance</p>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as SettingsState['theme'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System Default</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Font Size</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Adjust text size for better readability</p>
          </div>
          <select
            value={settings.fontSize}
            onChange={(e) => update({ fontSize: e.target.value as SettingsState['fontSize'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Language</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select application language</p>
          </div>
          <select
            value={settings.language}
            onChange={(e) => update({ language: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Time Format</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose between 12-hour and 24-hour format</p>
          </div>
          <select
            value={settings.timeFormat}
            onChange={(e) => update({ timeFormat: e.target.value as SettingsState['timeFormat'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="12h">12-hour (AM/PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Media Autoplay</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Automatically play videos and GIFs</p>
          </div>
          <button
            onClick={() => toggleSetting('mediaAutoplay')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.mediaAutoplay ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.mediaAutoplay ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );

  const renderChatSettings = () => (
    <div className="animate-fadein">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        Chat Settings
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Read Receipts</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Let others know when you've read their messages</p>
          </div>
          <button
            onClick={() => toggleSetting('readReceipts')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.readReceipts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.readReceipts ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Typing Indicators</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Show when you are typing</p>
          </div>
          <button
            onClick={() => toggleSetting('typingIndicators')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.typingIndicators ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.typingIndicators ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Sound Effects</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Play sounds for incoming messages</p>
          </div>
          <button
            onClick={() => toggleSetting('soundEnabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.soundEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Auto-download Media</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose when to download media automatically</p>
          </div>
          <select
            value={settings.autoDownloadMedia}
            onChange={(e) => update({ autoDownloadMedia: e.target.value as SettingsState['autoDownloadMedia'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="wifi">Wi-Fi Only</option>
            <option value="always">Always</option>
            <option value="never">Never</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="animate-fadein">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        Notifications
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Push Notifications</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Receive notifications when app is in background</p>
          </div>
          <button
            onClick={() => toggleSetting('pushNotifications')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.pushNotifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.pushNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Notification Tone</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select sound for notifications</p>
          </div>
          <select
            value={settings.notificationTone}
            onChange={(e) => update({ notificationTone: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="default">Default</option>
            <option value="chirp">Chirp</option>
            <option value="subtle">Subtle</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="animate-fadein">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        Privacy & Security
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Last Seen</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Who can see when you were last active</p>
          </div>
          <select
            value={settings.lastSeen}
            onChange={(e) => update({ lastSeen: e.target.value as SettingsState['lastSeen'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">Contacts Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Profile Photo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Who can see your profile photo</p>
          </div>
          <select
            value={settings.profilePhotoVisibility}
            onChange={(e) => update({ profilePhotoVisibility: e.target.value as SettingsState['profilePhotoVisibility'] })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">Contacts Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStorageSettings = () => (
    <div className="animate-fadein">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        Storage & Data
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">Clear Cache</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Free up space by clearing temporary files</p>
          </div>
          <button
            onClick={() => alert('Cache cleared!')}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
          >
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'storage', label: 'Storage', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Sidebar */}
            <div className="md:w-64 bg-gray-50 dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Settings</h1>
              </div>
              <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-3 px-6 py-3 text-left font-medium transition-colors whitespace-nowrap ${
                      activeTab === id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-r-4 md:border-r-4 border-blue-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 sm:p-8 lg:p-12">
              {activeTab === 'general' && renderGeneralSettings()}
              {activeTab === 'chat' && renderChatSettings()}
              {activeTab === 'notifications' && renderNotificationSettings()}
              {activeTab === 'privacy' && renderPrivacySettings()}
              {activeTab === 'storage' && renderStorageSettings()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
