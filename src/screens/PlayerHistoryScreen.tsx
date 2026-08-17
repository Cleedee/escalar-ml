import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerHistoryData, buildPlayerHistory, enrichWithRealScores } from '../services/playerHistory';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import usePageTitle from '../usePageTitle';

const POS_ORDER: Record<string, number> = { GOL: 0, LAT: 1, ZAG: 2, MEI: 3, ATA: 4, TEC: 5 };

export default function PlayerHistoryScreen({ navigation }: any) {
  usePageTitle('Histórico');
  const [histories, setHistories] = useState<PlayerHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriquecendo, setEnriquecendo] = useState(false);
  const [enriquecido, setEnriquecido] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await buildPlayerHistory();
      setHistories(data);
    } catch {
      setHistories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnriquecer = async () => {
    if (histories.length === 0) return;
    setEnriquecendo(true);
    try {
      const enriched = await enrichWithRealScores(histories);
      setHistories(enriched);
      setEnriquecido(true);
    } catch {
      // fallback silencioso — dados locais continuam disponíveis
    } finally {
      setEnriquecendo(false);
    }
  };

  const selected = histories.find((h) => h.atleta_id === selectedId);
  const selectedAppearances = selected?.appearances ?? [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Atletas</Text>
        <Text style={styles.subtitle}>
          {histories.length} atleta{histories.length !== 1 ? 's' : ''} · baseado nas escalações salvas
        </Text>
        <View style={styles.headerActions}>
          {!enriquecido && (
            <Button
              variant="outline"
              label={enriquecendo ? 'Buscando pontuações...' : 'Buscar pontuações reais'}
              onPress={handleEnriquecer}
              disabled={enriquecendo}
            />
          )}
          {enriquecido && (
            <Badge variant="primary" label="Com pontuações reais" size="sm" />
          )}
        </View>
      </View>

      {histories.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Nenhum atleta encontrado. Crie escalações para ver o histórico.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.listPanel}>
            <SectionHeader label="Atletas" />
            <FlatList
              data={histories}
              keyExtractor={(item) => String(item.atleta_id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item.atleta_id === selectedId;
                return (
                  <TouchableOpacity
                    style={[styles.atletaRow, isSelected && styles.atletaRowSelected]}
                    onPress={() => setSelectedId(isSelected ? null : item.atleta_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.atletaInfo}>
                      <Text style={styles.atletaName}>{item.apelido}</Text>
                      <Text style={styles.atletaDetail}>
                        {item.posicao} · {item.clube} · {item.total_appearances}{' '}
                        escalação{item.total_appearances !== 1 ? 'ões' : ''}
                      </Text>
                    </View>
                    <View style={styles.atletaRight}>
                      <Text style={styles.atletaMedia}>
                        {item.media_previsto.toFixed(1)} proj.
                      </Text>
                      {item.media_real != null && (
                        <Text style={styles.atletaMediaReal}>
                          {item.media_real.toFixed(1)} real
                        </Text>
                      )}
                      <Text style={styles.atletaArrow}>{isSelected ? '▾' : '▸'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {selected && (
            <View style={styles.detailPanel}>
              <Card>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailName}>{selected.apelido}</Text>
                    <Text style={styles.detailMeta}>
                      {selected.posicao} · {selected.clube} · {selected.total_appearances}{' '}
                      escalação{selected.total_appearances !== 1 ? 'ões' : ''}
                    </Text>
                  </View>
                  <View style={styles.detailStats}>
                    <View style={styles.detailStat}>
                      <Text style={styles.detailStatValue}>
                        {selected.media_previsto.toFixed(1)}
                      </Text>
                      <Text style={styles.detailStatLabel}>Média Proj.</Text>
                    </View>
                    {selected.media_real != null && (
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatValue, { color: theme.colors.info }]}>
                          {selected.media_real.toFixed(1)}
                        </Text>
                        <Text style={styles.detailStatLabel}>Média Real</Text>
                      </View>
                    )}
                    <View style={styles.detailStat}>
                      <Text style={styles.detailStatValue}>
                        {selected.appearances.length}
                      </Text>
                      <Text style={styles.detailStatLabel}>Rodadas</Text>
                    </View>
                  </View>
                </View>
              </Card>

              <ScrollView style={styles.tableScroll} horizontal>
                <View>
                  {/* Table header */}
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.rodadaCell]}>Rod</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Proj.</Text>
                    {enriquecido && (
                      <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Real</Text>
                    )}
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Preço</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Pr. Proj.</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Média</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.numCell]}>Var.</Text>
                    <Text style={[styles.tableCell, styles.tableCellHeader, styles.capCell]}>C</Text>
                  </View>
                  {/* Table body */}
                  {selectedAppearances.map((a) => (
                    <View key={a.rodada} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.rodadaCell]}>{a.rodada}</Text>
                      <Text style={[styles.tableCell, styles.numCell]}>{a.previsto.toFixed(1)}</Text>
                      {enriquecido && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.numCell,
                            a.pontuacao_real != null && a.pontuacao_real >= a.previsto
                              ? { color: theme.colors.primary }
                              : a.pontuacao_real != null
                                ? { color: theme.colors.danger }
                                : undefined,
                          ]}
                        >
                          {a.pontuacao_real != null ? a.pontuacao_real.toFixed(1) : '—'}
                        </Text>
                      )}
                      <Text style={[styles.tableCell, styles.numCell]}>
                        C${a.preco.toFixed(1)}
                      </Text>
                      <Text style={[styles.tableCell, styles.numCell]}>
                        {a.preco_projetado != null ? `C$${a.preco_projetado.toFixed(1)}` : '—'}
                      </Text>
                      <Text style={[styles.tableCell, styles.numCell]}>
                        {a.media_num.toFixed(1)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.numCell,
                          { color: a.variacao_num >= 0 ? theme.colors.primary : theme.colors.danger },
                        ]}
                      >
                        {a.variacao_num >= 0 ? '+' : ''}{a.variacao_num.toFixed(1)}
                      </Text>
                      <Text style={[styles.tableCell, styles.capCell]}>
                        {a.role === 'capitao' ? '⭐' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.footerNote}>
                Dados baseados nas escalações salvas localmente.
                {enriquecido
                  ? ' Pontuações reais do Cartola FC.'
                  : ' Toque em "Buscar pontuações reais" para ver os resultados.'}
              </Text>
            </View>
          )}
        </View>
      )}

      <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing['2xl'] },
  loadingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: theme.spacing.xl,
  },
  header: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  listPanel: {
    paddingHorizontal: theme.spacing.xl,
  },
  listContent: {
    paddingBottom: theme.spacing.xs,
  },
  atletaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  atletaRowSelected: {
    backgroundColor: theme.colors.primaryGlow,
    borderBottomColor: theme.colors.primary,
  },
  atletaInfo: { flex: 1 },
  atletaName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  atletaDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  atletaRight: { alignItems: 'flex-end', marginLeft: theme.spacing.sm },
  atletaMedia: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  atletaMediaReal: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.info,
    fontWeight: theme.fontWeight.medium,
  },
  atletaArrow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  detailPanel: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  detailHeader: { marginBottom: theme.spacing.md },
  detailName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  detailMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  detailStats: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailStat: { alignItems: 'center' },
  detailStatValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
  },
  detailStatLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wide,
  },
  tableScroll: { marginTop: theme.spacing.md },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableCell: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    textAlign: 'center',
  },
  tableCellHeader: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    fontSize: theme.fontSize.xs,
    letterSpacing: theme.letterSpacing.wide,
  },
  rodadaCell: { width: 40, textAlign: 'center' },
  numCell: { width: 60, textAlign: 'center' },
  capCell: { width: 30, textAlign: 'center' },
  footerNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
    lineHeight: theme.spacing.xl,
  },
});