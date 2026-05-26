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
  const { apelido } = route.params;
  const [data, setData] = useState<JustificarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJustificar(apelido)
      .then((d) => {
        if (!d.atleta) {
          setError('Atleta não encontrado');
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apelido]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#22c55e" />
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
  const statusColor =
    atleta.status === 'Provável' ? '#22c55e' :
    atleta.status === 'Duvidoso' ? '#f97316' : '#ef4444';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Player header */}
      <View style={styles.playerCard}>
        <View style={styles.playerMain}>
          <View>
            <Text style={styles.playerName}>{atleta.apelido}</Text>
            <Text style={styles.playerSub}>
              {atleta.posicao} · {atleta.clube}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{atleta.status}</Text>
          </View>
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
      </View>

      {/* Scout */}
      <Text style={styles.sectionTitle}>Scout (média por jogo)</Text>
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
      <Text style={styles.sectionTitle}>Desempenho Recente</Text>
      <View style={styles.recenteCard}>
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
      </View>

      {/* Next match */}
      <Text style={styles.sectionTitle}>Próxima Partida</Text>
      <View style={styles.partidaCard}>
        <Text style={styles.partidaText}>
          {partida.casa ? '🏠 Casa' : '✈️ Fora'} vs{' '}
          <Text style={styles.partidaAdv}>{partida.adversario}</Text>
        </Text>
      </View>

      {/* Methodology */}
      <Text style={styles.sectionTitle}>Metodologia</Text>
      <View style={styles.metodologiaCard}>
        <View style={styles.metBadge}>
          <Text style={styles.metBadgeText}>
            {metodologia.tipo === 'ml' ? 'ML' : metodologia.tipo}
          </Text>
        </View>
        <Text style={styles.metDesc}>{metodologia.descricao}</Text>
        <Text style={styles.metFormula}>{metodologia.formula}</Text>
      </View>

      {/* Risk profiles */}
      <Text style={styles.sectionTitle}>Análise por Perfil</Text>
      {analise_perfis.map((p) => (
        <View key={p.perfil} style={styles.perfilRow}>
          <Text style={styles.perfilName}>
            {p.perfil === 'neutro' ? 'Neutro' :
             p.perfil === 'agressivo' ? 'Agressivo' : 'Conservador'}
          </Text>
          <Text style={p.selecionado ? styles.perfilSim : styles.perfilNao}>
            {p.selecionado ? 'Selecionado' : 'Descartado'}
          </Text>
        </View>
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
    backgroundColor: '#0f172a',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    padding: 20,
    paddingBottom: 40,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  backBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  playerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  playerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  playerSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  scoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoutItem: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
  },
  scoutKey: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  scoutLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  scoutValue: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  scoutMedia: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  recenteCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  recenteBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 12,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValue: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
  },
  bar: {
    width: 24,
    backgroundColor: '#22c55e',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  recenteMedia: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  partidaCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  partidaText: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  partidaAdv: {
    fontWeight: '700',
    color: '#f8fafc',
  },
  metodologiaCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  metBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  metBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  metDesc: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  metFormula: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  perfilRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  perfilName: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  perfilSim: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  perfilNao: {
    fontSize: 14,
    color: '#64748b',
  },
});
