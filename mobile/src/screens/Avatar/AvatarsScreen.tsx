import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Plus, User } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { api } from '@/utils/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setAvatars, setLoading } from '@/store/slices/avatarSlice';

const AvatarsScreen = () => {
  const dispatch = useAppDispatch();
  const { avatars, loading } = useAppSelector((state) => state.avatar);

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      dispatch(setLoading(true));
      const data = await api.avatar.list();
      dispatch(setAvatars(data));
    } catch (error) {
      console.error('Failed to load avatars:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Avatare</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('AvatarCreate')}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Avatar List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Lade Avatare...</Text>
        ) : avatars.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={64} color={colors.text.light} />
            <Text style={styles.emptyTitle}>Noch keine Avatare</Text>
            <Text style={styles.emptyDesc}>
              Erstelle deinen ersten Avatar, um Geschichten zu erleben!
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AvatarCreate')}
            >
              <Text style={styles.emptyButtonText}>Avatar erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {avatars.map((avatar) => (
              <TouchableOpacity
                key={avatar.id}
                style={styles.avatarCard}
                onPress={() => navigation.navigate('AvatarDetail', { avatarId: avatar.id })}
              >
                {avatar.imageUrl ? (
                  <Image source={{ uri: avatar.imageUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={32} color={colors.lavender[500]} />
                  </View>
                )}
                <Text style={styles.avatarName}>{avatar.name}</Text>
                {avatar.description && (
                  <Text style={styles.avatarDesc} numberOfLines={2}>
                    {avatar.description}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  createButton: {
    backgroundColor: colors.lavender[500],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyButton: {
    backgroundColor: colors.lavender[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  avatarCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lavender[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  avatarDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default AvatarsScreen;
