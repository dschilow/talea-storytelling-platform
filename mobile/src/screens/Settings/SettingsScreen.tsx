import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Trash2, Database, Bell, Moon, Info } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StorageUtil } from '@/utils/storage/AsyncStorageUtil';
import { useTheme } from '@/utils/theme/ThemeContext';
import { useThemedColors } from '@/utils/theme/useThemedColors';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { isDark, toggleTheme } = useTheme();
  const colors = useThemedColors();

  const [cacheSize, setCacheSize] = useState(0);
  const [settings, setSettings] = useState({
    notifications: true,
    autoDownload: true,
  });

  useEffect(() => {
    loadSettings();
    loadCacheSize();
  }, []);

  const loadSettings = async () => {
    const notifications = await StorageUtil.loadSetting('notifications', true);
    const autoDownload = await StorageUtil.loadSetting('autoDownload', true);

    setSettings({ notifications, autoDownload });
  };

  const loadCacheSize = async () => {
    const size = await StorageUtil.getCacheSize();
    setCacheSize(size);
  };

  const updateSetting = async (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
    await StorageUtil.saveSetting(key, value);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Cache leeren',
      'Möchtest du wirklich alle zwischengespeicherten Daten löschen? Offline-Daten gehen verloren.',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Ja, leeren',
          style: 'destructive',
          onPress: async () => {
            await StorageUtil.clearCache();
            setCacheSize(0);
            Alert.alert('Erfolg', 'Cache wurde geleert');
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: colors.background.primary,
        borderBottomColor: colors.border.medium
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Einstellungen</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Notifications */}
        <Card variant="elevated" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Benachrichtigungen</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Bell size={20} color={colors.text.secondary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Push-Benachrichtigungen</Text>
                <Text style={[styles.settingDesc, { color: colors.text.secondary }]}>
                  Erhalte Updates wenn Geschichten fertig sind
                </Text>
              </View>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
              trackColor={{ false: colors.border.medium, true: colors.lavender[300] }}
              thumbColor={settings.notifications ? colors.lavender[500] : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Appearance */}
        <Card variant="elevated" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Darstellung</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Moon size={20} color={colors.text.secondary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Dark Mode</Text>
                <Text style={[styles.settingDesc, { color: colors.text.secondary }]}>Dunkles Erscheinungsbild aktivieren</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border.medium, true: colors.lavender[300] }}
              thumbColor={isDark ? colors.lavender[500] : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Storage */}
        <Card variant="elevated" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Speicher</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Database size={20} color={colors.text.secondary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Automatischer Download</Text>
                <Text style={[styles.settingDesc, { color: colors.text.secondary }]}>
                  Geschichten automatisch für Offline-Zugriff speichern
                </Text>
              </View>
            </View>
            <Switch
              value={settings.autoDownload}
              onValueChange={(value) => updateSetting('autoDownload', value)}
              trackColor={{ false: colors.border.medium, true: colors.lavender[300] }}
              thumbColor={settings.autoDownload ? colors.lavender[500] : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border.medium }]} />

          <View style={styles.cacheInfo}>
            <View style={styles.cacheRow}>
              <Text style={[styles.cacheLabel, { color: colors.text.secondary }]}>Gespeicherte Daten:</Text>
              <Text style={[styles.cacheValue, { color: colors.text.primary }]}>  {formatBytes(cacheSize)}</Text>
            </View>
            <Button
              title="Cache leeren"
              onPress={handleClearCache}
              variant="outline"
              size="small"
              icon={<Trash2 size={16} color={colors.coral[500]} />}
              style={styles.clearButton}
            />
          </View>
        </Card>

        {/* About */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.aboutHeader}>
            <Info size={20} color={colors.lavender[500]} />
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Über Talea</Text>
          </View>

          <View style={styles.aboutContent}>
            <Text style={[styles.aboutText, { color: colors.text.secondary }]}>Version 1.0.0</Text>
            <Text style={[styles.aboutText, { color: colors.text.secondary }]}>Made with ❤️ for Storytellers</Text>
            <Text style={[styles.aboutCopyright, { color: colors.text.light }]}>© 2025 Talea Platform</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },

  // Settings Items
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },

  // Cache
  divider: {
    height: 1,
    backgroundColor: colors.border.medium,
    marginVertical: 16,
  },
  cacheInfo: {
    paddingTop: 8,
  },
  cacheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cacheLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  cacheValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  clearButton: {
    marginTop: 4,
  },

  // About
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  aboutContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  aboutCopyright: {
    fontSize: 12,
    color: colors.text.light,
    marginTop: 8,
  },
});

export default SettingsScreen;
