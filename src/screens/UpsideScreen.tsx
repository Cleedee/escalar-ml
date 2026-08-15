import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UpsideAthlete } from '../types';
import { fetchUpside } from '../services/api';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';
import usePageTitle from '../usePageTitle';

const POSICOES = [
  { key: '', label: 'Todas' },
  { key: 'GOL', label: 'Goleiro' },
  { key: 'LAT', label: 'Lateral' },
  { key: 'ZAG', label: 'Zagueiro' },
  { key: 'MEI', label: 'Meia' },
  { key: 'ATA', label: 'Atacante' },
  { key: 'TEC', label: 'Técnico' },
];

const POS_MAP: Record<string, string> = {
  GOL: 'Goleiro',
  LAT: 'Lateral',
  ZAG: 'Zagueiro',
  MEI: 'Meia',
  ATA: 'Atacante',
  TEC: 'Técnico',
};

function statusBadgeVariant(status: string): 'primary' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'Provável': return 'primary';
    case 'Duvidoso': return 'warning';
    case 'Suspenso':
    case 'Lesionado':
    case 'Nulo': return 'danger';
    default: return 'neutral';
  }
}

export default function UpsideScreen({ navigation }: any) {
  usePageTitle('Upside');
  const [posicao, setPosicao] = useState('');
  const [atletas, setAtletas] = useState<UpsideAthlete[]>([]);
  const [total, setTotal] = useState(0);
  const [criteria, setCriteria] = useState<{ top: number; min_jogos: number }>({ top: 30, min_jogos: 5 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showPosicao, setShowPosicao] = useState(false);

  const doFetch = (p: string) => {
    setLoading(true);
    setError(false);
    fetchUpside({ posicao: p || undefined })
      .then((data) => {
        setAtletas(data.atletas);
        setTotal(data.total);
        setCriteria(data.criteria);
      })
      .catch(() => {
        setError(true);
        setAtletas([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    doFetch(posicao);
  }, [posicao]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upside</Text>

      <Card style={styles.heroCard}>
        <Text style={styles.heroTitle}>Quem pode explodir na rodada</Text>
        <Text style={styles.heroBody}>
          Ranking por <Text style={styles.bold}>upside_score</Text>: quanto o atleta sobe acima da
          própria média (p90 − média) e com que frequência pontua alto (8+ e 10+ pts). São
          candidatos a surpreender — bom para o perfil <Text style={styles.bold}>Upside</Text>.
        </Text>
      </Card>

      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowPosicao((v) => !v)} activeOpacity={0.7}>
        <SectionHeader label="Posição" action={<Text style={styles.chevron}>{showPosicao ? '▲' : '▼'}</Text>} />
      </TouchableOpacity>
      {showPosicao && (
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {POSICOES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, posicao === item.key && styles.filterChipActive]}
                onPress={() => setPosicao(item.key)}
              >
                <Text style={[styles.filterChipText, posicao === item.key && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.resultCount}>
        {loading ? 'Carregando...' : `${atletas.length} de ${total} atletas · min ${criteria.min_jogos} jogos`}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Não foi possível carregar o ranking. Tente novamente.</Text>
        </View>
      ) : (
        <FlatList
          data={atletas}
          keyExtractor={(item) => String(item.atleta_id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Card>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardRank}>#{index + 1}</Text>
                  <View>
                    <Text style={styles.cardNome}>{item.apelido}</Text>
                    <Text style={styles.cardSub}>
                      {POS_MAP[item.posicao] || item.posicao} · {item.clube}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Badge label={item.status} variant={statusBadgeVariant(item.status)} />
                  <View style={styles.upsideScoreBox}>
                    <Text style={styles.upsideScoreValue}>{item.upside_score.toFixed(1)}</Text>
                    <Text style={styles.upsideScoreLabel}>UPSIDE</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>C$ {item.preco.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Preço</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.media.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Média</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.colors.accent }]}>{item.p90.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Teto (p90)</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.previsto.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Previsto</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.footerFreq}>
                  8+ pts: <Text style={styles.footerFreqBold}>{(item.freq_alta_8 * 100).toFixed(0)}%</Text>
                </Text>
                <Text style={styles.footerFreq}>
                  10+ pts: <Text style={styles.footerFreqBold}>{(item.freq_alta_10 * 100).toFixed(0)}%</Text>
                </Text>
                <Text style={styles.footerFreq}>
                  Desvio: <Text style={styles.footerFreqBold}>{item.desvio_padrao.toFixed(1)}</Text>
                </Text>
                <Text style={styles.footerFreq}>
                  {item.jogos} jogos
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    letterSpacing: theme.letterSpacing.tight,
  },
  heroCard: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHighlight,
    borderColor: theme.colors.accent,
  },
  heroTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
    letterSpacing: theme.letterSpacing.tight,
  },
  heroBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  bold: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  filterRow: {
    height: 44,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  filterContent: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sectionToggle: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing['2xl'],
  },
  chevron: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceElevated,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentGlow,
  },
  filterChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  filterChipTextActive: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.bold,
  },
  resultCount: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardRank: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.textMuted,
    marginRight: theme.spacing.md,
  },
  cardNome: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  cardSub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  upsideScoreBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.accentGlow,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  upsideScoreValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  upsideScoreLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    letterSpacing: theme.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wide,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  footerFreq: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  footerFreqBold: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
});
