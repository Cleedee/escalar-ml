import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { JustificarResponse } from '../types';
import { fetchJustificar } from '../services/api';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

const SCOUT_LABELS: Record<string, string> = {
  A: 'Assistência',
  CA: 'Cartão Amarelo',
  CV: 'Cartão Vermelho',
  DD: 'Defesa Difícil',
  DP: 'Defesa de Pênalti',
  DS: 'Desarme',
  FC: 'Falta Cometida',
  FD: 'Finalização Defendida',
  FF: 'Finalização pra Fora',
  FS: 'Falta Sofrida',
  FT: 'Finalização na Trave',
  G: 'Gol',
  GS: 'Gol Sofrido',
  I: 'Impedimento',
  PE: 'Passes Errados',
  PP: 'Pênalti Perdido',
  PS: 'Pênalti Sofrido',
  SG: 'Jogo Sem Sofrer Gol',
  GC: 'Gol Contra',
};

export default function JustificarScreen({ route, navigation }: any) {
  const { apelido, atleta_id, clube } = route.params;
  const [data, setData] = useState<JustificarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJustificar(apelido, atleta_id, clube)
      .then((d) => {
        if (!d.atleta) {
          setError('Atleta não encontrado');
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apelido, atleta_id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !data || !data.atleta) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error || 'Atleta não encontrado'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { atleta, scout, desempenho_recente, partida, metodologia, analise_perfis } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Player header */}
      <Card>
        <View style={styles.playerMain}>
          <View>
            <Text style={styles.playerName}>{atleta.apelido}</Text>
            <Text style={styles.playerSub}>
              {atleta.posicao} · {atleta.clube}
            </Text>
          </View>
          <Badge
            label={atleta.status}
            variant={atleta.status === 'Provável' ? 'primary' : atleta.status === 'Duvidoso' ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.playerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>C$ {atleta.preco.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Preço</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{atleta.previsao.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Previsão</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{atleta.media.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Média</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{atleta.jogos}</Text>
            <Text style={styles.statLabel}>Jogos</Text>
          </View>
        </View>
      </Card>

      {/* Scout */}
      <SectionHeader label="Scout (média por jogo)" />
      <View style={styles.scoutGrid}>
        {Object.entries(scout).map(([key, item]) => (
          <View key={key} style={styles.scoutItem}>
            <Text style={styles.scoutKey}>{key}</Text>
            <Text style={styles.scoutLabel}>
              {SCOUT_LABELS[key] || key}
            </Text>
            <Text style={styles.scoutValue}>{item.pontos.toFixed(2)} pts</Text>
            <Text style={styles.scoutMedia}>média: {item.media.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Recent performance */}
      <SectionHeader label="Desempenho Recente" />
      <Card>
        <View style={styles.recenteBars}>
          {desempenho_recente.rodadas.map((r) => {
            const maxPts = Math.max(...desempenho_recente.rodadas.map((x) => x.pontos), 1);
            const height = (r.pontos / maxPts) * 100;
            return (
              <View key={r.rodada} style={styles.barCol}>
                <Text style={styles.barValue}>{r.pontos.toFixed(1)}</Text>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(height, 4) },
                  ]}
                />
                <Text style={styles.barLabel}>R{r.rodada}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.recenteMedia}>
          Média últimos 5: {desempenho_recente.media_ult5.toFixed(1)} pts
        </Text>
      </Card>

      {/* Next match */}
      <SectionHeader label="Próxima Partida" />
      <Card>
        <Text style={styles.partidaText}>
          {partida.casa ? '🏠 Casa' : '✈️ Fora'} vs{' '}
          <Text style={styles.partidaAdv}>{partida.adversario}</Text>
        </Text>
      </Card>

      {/* Methodology */}
      <SectionHeader label="Metodologia" />
      <Card>
        <Badge label={metodologia.tipo === 'ml' ? 'ML' : metodologia.tipo} variant="info" />
        <Text style={styles.metDesc}>{metodologia.descricao}</Text>
        <Text style={styles.metFormula}>{metodologia.formula}</Text>
      </Card>

      {/* Risk profiles */}
      <SectionHeader label="Análise por Perfil" />
      {analise_perfis.map((p) => (
        <Card key={p.perfil}>
          <View style={styles.perfilRowInner}>
            <Text style={styles.perfilName}>
              {p.perfil === 'neutro' ? 'Neutro' :
               p.perfil === 'agressivo' ? 'Agressivo' : 'Conservador'}
            </Text>
            <Badge
              label={p.selecionado ? 'Selecionado' : 'Descartado'}
              variant={p.selecionado ? 'primary' : 'neutral'}
            />
          </View>
        </Card>
      ))}

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  inner: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'] + theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  backBtnText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  playerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  playerName: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  playerSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  scoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  scoutItem: {
    width: '48%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  scoutKey: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  scoutLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  scoutValue: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  scoutMedia: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  recenteBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: theme.spacing.md,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValue: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  bar: {
    width: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  recenteMedia: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  partidaText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  partidaAdv: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  metDesc: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  metFormula: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontFamily: 'monospace',
  },
  perfilName: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  perfilRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
