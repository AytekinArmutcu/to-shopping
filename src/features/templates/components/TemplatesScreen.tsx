import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  IconButton,
  List,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

import { buildTemplateOverview, cleanTemplateName, MAX_TEMPLATE_NAME_LENGTH } from '../logic';
import { deleteTemplate, renameTemplate, templateCountsQuery, templatesQuery } from '../repository';

/**
 * Vorlagen verwalten (FR-5.5).
 *
 * Nur Umbenennen und Loeschen - **angewendet** wird eine Vorlage dort, wo sie
 * hingehoert: auf der Liste. Ein "Anwenden" hier muesste erst fragen, auf
 * welche Liste, und das ist eine Frage, die der Nutzer sich auf der Liste
 * stehend gar nicht stellt.
 */
export function TemplatesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();

  const templateRows = useLiveQuery(templatesQuery());
  const countRows = useLiveQuery(templateCountsQuery());

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [renameFor, setRenameFor] = useState<{ id: string; name: string } | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () => buildTemplateOverview(templateRows.data ?? [], countRows.data ?? []),
    [templateRows.data, countRows.data],
  );

  const rename = useCallback(() => {
    const name = cleanTemplateName(nameDraft);
    const target = renameFor;
    setRenameFor(null);

    if (name === null || target === null) {
      return;
    }

    void renameTemplate(target.id, name);
  }, [nameDraft, renameFor]);

  const remove = useCallback(() => {
    const target = deleteFor;
    setDeleteFor(null);

    if (target === null) {
      return;
    }

    void deleteTemplate(target.id).then(() => {
      setMessage(t('templates.deleted', { name: target.name }));
    });
  }, [deleteFor, t]);

  // Siehe ADR-026: Der Dialog haengt im Portal desselben Fensters.
  const dialogStyle = { marginBottom: keyboardHeight };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} accessibilityLabel={t('templates.back')} />
        <Appbar.Content title={t('templates.title')} />
      </Appbar.Header>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        testID="templates"
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={t('templates.count', { count: item.itemCount })}
            testID={`template-${item.name}`}
            style={styles.row}
            right={() => (
              <Menu
                visible={menuFor === item.id}
                onDismiss={() => setMenuFor(null)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => setMenuFor(item.id)}
                    accessibilityLabel={t('templates.more', { name: item.name })}
                    testID={`template-more-${item.name}`}
                    style={styles.more}
                  />
                }
              >
                <Menu.Item
                  leadingIcon="pencil"
                  title={t('templates.rename')}
                  testID="template-rename"
                  onPress={() => {
                    setMenuFor(null);
                    setNameDraft(item.name);
                    setRenameFor({ id: item.id, name: item.name });
                  }}
                />
                <Menu.Item
                  leadingIcon="delete-outline"
                  title={t('templates.delete')}
                  testID="template-delete"
                  onPress={() => {
                    setMenuFor(null);
                    setDeleteFor({ id: item.id, name: item.name });
                  }}
                />
              </Menu>
            )}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty} testID="templates-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('templates.emptyTitle')}
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
              {t('templates.emptyHint')}
            </Text>
          </View>
        }
      />

      <Portal>
        <Dialog
          visible={renameFor !== null}
          onDismiss={() => setRenameFor(null)}
          style={dialogStyle}
        >
          <Dialog.Title>{t('templates.renameTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={nameDraft}
              onChangeText={setNameDraft}
              label={t('templates.nameLabel')}
              maxLength={MAX_TEMPLATE_NAME_LENGTH}
              testID="template-rename-input"
              onSubmitEditing={rename}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameFor(null)}>{t('common.cancel')}</Button>
            <Button onPress={rename} testID="template-rename-confirm">
              {t('templates.renameConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteFor !== null} onDismiss={() => setDeleteFor(null)}>
          <Dialog.Title>{t('templates.deleteTitle', { name: deleteFor?.name ?? '' })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('templates.deleteHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteFor(null)}>{t('common.cancel')}</Button>
            <Button onPress={remove} testID="template-delete-confirm">
              {t('templates.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={3000}
        testID="templates-snackbar"
      >
        {message ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    minHeight: 64,
    justifyContent: 'center',
  },
  more: {
    margin: 0,
    width: 48,
    height: 48,
  },
  empty: {
    paddingHorizontal: 32,
    paddingTop: 64,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyHint: {
    opacity: 0.7,
  },
});
