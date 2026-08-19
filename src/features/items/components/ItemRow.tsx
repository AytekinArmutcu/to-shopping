import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Divider, IconButton, Text } from 'react-native-paper';

export type ItemRowData = {
  id: string;
  name: string;
};

type Props = {
  item: ItemRowData;
  onRemove: (id: string) => void;
};

/**
 * Eine Zeile der Einkaufsliste.
 *
 * In M2 kann sie nur anzeigen und entfernen. Abhaken samt Wischgeste kommt in
 * M3, Menge und Notiz in M4 - die Zeile wird dann erweitert, nicht ersetzt.
 *
 * Die Trefferflaeche des Entfernen-Knopfes ist bewusst 48 dp gross und
 * beschriftet, weil das laut CLAUDE.md fuer jedes Bedienelement gilt.
 */
export function ItemRow({ item, onRemove }: Props) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.row} testID={`item-${item.name}`}>
        <Text variant="bodyLarge" style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <IconButton
          icon="close"
          size={20}
          onPress={() => onRemove(item.id)}
          accessibilityLabel={t('item.remove', { name: item.name })}
          style={styles.button}
        />
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 4,
    gap: 8,
  },
  name: {
    flex: 1,
  },
  button: {
    margin: 0,
    width: 48,
    height: 48,
  },
});
