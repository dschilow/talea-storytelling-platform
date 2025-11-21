import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Plus, User, Grid, List, Search } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { api } from '@/utils/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setAvatars, setLoading } from '@/store/slices/avatarSlice';

const AvatarsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { avatars, loading } = useAppSelector((state) => state.avatar);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter avatars based on search query
  const filteredAvatars = avatars.filter((avatar) => {
    const query = searchQuery.toLowerCase();
    return (
      avatar.name.toLowerCase().includes(query) ||
      avatar.description?.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Avatare</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? (
              <List size={24} color={colors.text.secondary} />
            ) : (
              <Grid size={24} color={colors.text.secondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('AvatarCreate')}
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {avatars.length > 0 && (
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Avatare durchsuchen..."
            placeholderTextColor={colors.text.light}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

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
        ) : filteredAvatars.length === 0 ? (
          <View style={styles.emptyState}>
            <Search size={64} color={colors.text.light} />
            <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={styles.emptyDesc}>
              Keine Avatare gefunden für "{searchQuery}"
            </Text>
          </View>
        ) : (
          <View style={viewMode === 'grid' ? styles.grid : styles.list}>
            {filteredAvatars.map((avatar) => (
              <TouchableOpacity
                key={avatar.id}
                style={viewMode === 'grid' ? styles.avatarCard : styles.avatarListItem}
                onPress={() => navigation.navigate('AvatarDetail', { avatarId: avatar.id })}
              >
                {avatar.imageUrl ? (
                  <Image source={{ uri: avatar.imageUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={32} color={colors.lavender[500]} />
                  </View>
                )}
                <View style={viewMode === 'list' ? styles.avatarListInfo : undefined}>
                  <Text style={styles.avatarName}>{avatar.name}</Text>
                  {avatar.description && (
                    <Text style={styles.avatarDesc} numberOfLines={viewMode === 'grid' ? 2 : 1}>
                      {avatar.description}
                    </Text>
                  )}
                </View>
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: colors.lavender[500],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 20,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.medium,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
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
  list: {
    gap: 12,
  },
  avatarCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  avatarListItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  avatarListInfo: {
    flex: 1,
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
