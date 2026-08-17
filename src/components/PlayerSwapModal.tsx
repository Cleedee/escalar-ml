import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartolaAthlete } from '../types';
import { fetchClubes, fetchMercado } from '../services/api';
import { theme } from '../theme';
import Button from './Button';

const POS_ID: Record<string, number> = { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 5, TEC: 6 };

interface PlayerSwapModalProps {
  visible: boolean;
  posicao: string;
  apelidoAtual: string;
  precoSaindo: number;
  orcamentoUsado: number;
  orcamentoMax?: number;
  onClose: () => void;
  onConfirm: (athlete: CartolaAthlete) => void;
}

export default function PlayerSwapModal({
  visible,
  posicao,
  apelidoAtual,
  precoSaindo,
  orcamentoUsado,
  orcamentoMax,
  onClose,
  onConfirm,
}: PlayerSwapModalProps) {
  const [atletas, setAtletas] = useState<CartolaAthlete[]>([]);
  const [clubeMap, setClubeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelectedId(null);
      return;
    }
    setLoading(true);
    Promise.all([fetchMercado(), fetchClubes()])
      .then(([mercado, clubes]) => {
        const posId = POS_ID[posicao];
        const lista = Object.values(mercado.atletas)
          .filter((a) => a.posicao_id === posId)
          .sort((a, b) => b.preco_num - a.preco_num);
        setAtletas(lista);
        const map: Record<string, string> = {};
        for (const [id, c] of Object.entries(clubes)) {
          map[id] = c.nome;
        }
        setClubeMap(map);
      })
      .catch(() => setAtletas([]))
      .finally(() => setLoading(false));
  }, [visible, posicao]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return atletas.slice(0, 40);
    return atletas
      .filter((a) => a.apelido.toLowerCase().includes(q))
      .slice(0, 40);
  }, [atletas, query]);

  const selected = atletas.find((a) => a.atleta_id === selectedId) ?? null;

  const novoOrcamento = useMemo(
    () => orcamentoUsado - precoSaindo + (selected?.preco_num ?? precoSaindo),
    [orcamentoUsado, precoSaindo, selected],
  );

  const estouraOrcamento = orcamentoMax != null && novoOrcamento > orcamentoMax + 0.001;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Trocar {apelidoAtual}</Text>
              <Text style={styles.subtitle}>
                {posicao} · saindo C$ {precoSaindo.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por apelido..."
            placeholderTextColor={theme.colors.textMuted}
            autoFocus
          />

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loading} />
          ) : (
            <ScrollView style={styles.list}>
              {filtered.length === 0 ? (
                <Text style={styles.empty}>Nenhum atleta encontrado</Text>
              ) : (
                filtered.map((a) => {
                  const isSelected = a.atleta_id === selectedId;
                  return (
                    <TouchableOpacity
                      key={a.atleta_id}
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() => setSelectedId(a.atleta_id)}
                    >
                      <View style={styles.itemLeft}>
                        <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                          {a.apelido}
                        </Text>
                        <Text style={styles.itemDetail}>
                          {clubeMap[String(a.clube_id)] || a.clube_id} · média {a.media_num.toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemPreco}>C$ {a.preco_num.toFixed(2)}</Text>
                        {isSelected && <Text style={styles.itemCheck}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>Novo orçamento</Text>
              <Text style={[styles.footerValue, estouraOrcamento && styles.footerValueOver]}>
                C$ {novoOrcamento.toFixed(2)}
                {orcamentoMax != null ? ` / C$ ${orcamentoMax.toFixed(2)}` : ''}
              </Text>
              {estouraOrcamento && (
                <Text style={styles.footerOver}>Excede o orçamento disponível</Text>
              )}
            </View>
            <Button
              variant="primary"
              label="Trocar"
              disabled={!selected || estouraOrcamento}
              onPress={() => selected && onConfirm(selected)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '85%',
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  close: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
    padding: theme.spacing.xs,
  },
  search: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  loading: {
    marginVertical: theme.spacing['2xl'],
  },
  list: {
    maxHeight: 420,
  },
  empty: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
    fontSize: theme.fontSize.base,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemSelected: {
    backgroundColor: theme.colors.primaryGlow,
    borderRadius: theme.borderRadius.md,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  itemNameSelected: {
    color: theme.colors.primaryLight,
  },
  itemDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  itemPreco: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  itemCheck: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  footerLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wide,
  },
  footerValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    marginTop: 2,
  },
  footerValueOver: {
    color: theme.colors.danger,
  },
  footerOver: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: 2,
  },
});
