import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FORMACOES, Lineup, OtimizarParams, Player, Tecnico } from '../types';

const PESOS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
import { fetchPontuados, postOtimizar } from '../services/api';
import { saveLineup } from '../services/storage';

export default function NewLineupScreen({ route, navigation }: any) {
  const rodada = route.params?.rodada ?? 0;

  const [nome, setNome] = useState(`Rodada ${rodada}`);
  const [orcamento, setOrcamento] = useState('100');
  const [formacao, setFormacao] = useState('auto');
  const [perfil, setPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [modo, setModo] = useState<'max-pontos' | 'valorizacao'>('max-pontos');
  const [pesoValorizacao, setPesoValorizacao] = useState(0.5);
  const [incluirDuvidosos, setIncluirDuvidosos] = useState(false);
  const [reservaLuxo, setReservaLuxo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Lineup | null>(null);
  const [feedback, setFeedback] = useState('');

  async function handleGenerate() {
    const budget = parseFloat(orcamento);
    if (isNaN(budget) || budget <= 0) {
      Alert.alert('Erro', 'Informe um orçamento válido');
      return;
    }
    if (!nome.trim()) {
      Alert.alert('Erro', 'Informe um nome para a escalação');
      return;
    }

    const params: OtimizarParams = {
      orcamento: budget,
      formacao,
      perfil,
      modo,
      ...(modo === 'valorizacao' ? { peso_valorizacao: pesoValorizacao } : {}),
      incluir_duvidosos: incluirDuvidosos,
      reserva_luxo: reservaLuxo,
    };

    setError(null);
    setFeedback('Enviando para o servidor...');
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await postOtimizar(params);
      clearTimeout(timeout);
      const lineup: Lineup = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nome: nome.trim(),
        rodada,
        created_at: new Date().toISOString(),
        params,
        response,
      };
      await saveLineup(lineup);
      setResult(lineup);
    } catch (e: any) {
      const msg = e.name === 'AbortError'
        ? 'O servidor demorou muito para responder. Tente novamente.'
        : e.message || 'Falha ao gerar escalação';
      setError(msg);
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
      setFeedback('');
    }
  }

  if (result) {
    return <ResultView lineup={result} navigation={navigation} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Nova Escalação</Text>
      <Text style={styles.subtitle}>Rodada {rodada}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={nome}
        onChangeText={setNome}
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Orçamento (C$)</Text>
      <TextInput
        style={styles.input}
        value={orcamento}
        onChangeText={setOrcamento}
        keyboardType="decimal-pad"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Formação</Text>
      <View style={styles.pickerRow}>
        {FORMACOES.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.pickerItem, formacao === f && styles.pickerActive]}
            onPress={() => setFormacao(f)}
          >
            <Text
              style={[
                styles.pickerText,
                formacao === f && styles.pickerTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Perfil de Risco</Text>
      <View style={styles.pickerRow}>
        {(['neutro', 'agressivo', 'conservador'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.pickerItem, perfil === p && styles.pickerActive]}
            onPress={() => setPerfil(p)}
          >
            <Text
              style={[
                styles.pickerText,
                perfil === p && styles.pickerTextActive,
              ]}
            >
              {p === 'neutro' ? 'Neutro' : p === 'agressivo' ? 'Agressivo' : 'Conservador'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Modo</Text>
      <View style={styles.pickerRow}>
        {(['max-pontos', 'valorizacao'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.pickerItem, modo === m && styles.pickerActive]}
            onPress={() => setModo(m)}
          >
            <Text
              style={[
                styles.pickerText,
                modo === m && styles.pickerTextActive,
              ]}
            >
              {m === 'max-pontos' ? 'Max Pontos' : 'Valorização'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {modo === 'valorizacao' && (
        <>
          <Text style={styles.label}>Peso da Valorização</Text>
          <View style={styles.pickerRow}>
            {PESOS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.pesoItem, pesoValorizacao === p && styles.pesoActive]}
                onPress={() => setPesoValorizacao(p)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    pesoValorizacao === p && styles.pickerTextActive,
                  ]}
                >
                  {p.toFixed(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Incluir duvidosos</Text>
        <Switch
          value={incluirDuvidosos}
          onValueChange={setIncluirDuvidosos}
          trackColor={{ false: '#334155', true: '#22c55e' }}
          thumbColor="#f8fafc"
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Reserva de luxo</Text>
        <Switch
          value={reservaLuxo}
          onValueChange={setReservaLuxo}
          trackColor={{ false: '#334155', true: '#22c55e' }}
          thumbColor="#f8fafc"
        />
      </View>

      <TouchableOpacity
        style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>Gerar Escalação</Text>
        )}
      </TouchableOpacity>
      {feedback !== '' && (
        <Text style={styles.feedback}>{feedback}</Text>
      )}
      {error !== null && (
        <Text style={styles.errorMsg}>{error}</Text>
      )}
    </ScrollView>
  );
}

function ResultView({
  lineup,
  navigation,
}: {
  lineup: Lineup;
  navigation: any;
}) {
  const { response } = lineup;
  const [actualScores, setActualScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchPontuados(lineup.rodada)
      .then((data) => {
        const scores: Record<string, number> = {};
        for (const [id, athlete] of Object.entries(data.atletas)) {
          scores[id] = athlete.pontuacao;
        }
        setActualScores(scores);
      })
      .catch(() => {});
  }, [lineup.rodada]);

  const getActual = (atleta_id: number): number | null => {
    if (!actualScores) return null;
    return actualScores[String(atleta_id)] ?? null;
  };

  const hasActual = actualScores !== null;

  const allPlayers = [
    ...response.players,
    ...(response.tecnico ? [response.tecnico] : []),
  ];
  const totalReal = hasActual
    ? allPlayers.reduce((sum, p) => sum + (getActual(p.atleta_id) ?? 0), 0)
    : null;

  const posicoes: Record<string, string> = {
    GOL: 'Goleiro',
    LAT: 'Lateral',
    ZAG: 'Zagueiro',
    MEI: 'Meia',
    ATA: 'Atacante',
    TEC: 'Técnico',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{lineup.nome}</Text>
        <Text style={styles.resultFormacao}>
          {response.formation} · Proj: {response.pontos_previstos.toFixed(1)} pts
          {totalReal !== null ? ` · Real: ${totalReal.toFixed(1)} pts` : ''}
        </Text>
        <Text style={styles.resultOrcamento}>
          C$ {response.orcamento_usado.toFixed(2)} usados
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Titulares</Text>
      {response.players.map((p: Player) => {
        const real = getActual(p.atleta_id);
        return (
          <View key={p.atleta_id} style={styles.playerRow}>
            <View style={styles.playerLeft}>
              <Text style={styles.playerPos}>
                {posicoes[p.posicao] || p.posicao}
              </Text>
              <Text style={styles.playerName}>
                {p.apelido} · {p.clube}{p.role === 'capitao' ? ' ⭐' : ''}
              </Text>
            </View>
            <View style={styles.playerRight}>
              <Text style={styles.playerClub}>{p.clube}</Text>
              <Text style={styles.playerPrice}>
                C$ {p.preco.toFixed(2)} · {p.previsto.toFixed(1)}
                {real !== null ? ` (${real.toFixed(1)})` : ''} pts
              </Text>
            </View>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('Justificar', { apelido: p.apelido, atleta_id: p.atleta_id, clube: p.clube })}
            >
              <Text style={styles.detailBtnText}>i</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {response.tecnico && (() => {
        const real = getActual(response.tecnico.atleta_id);
        return (
          <>
            <Text style={styles.sectionTitle}>Técnico</Text>
            <View style={styles.tecnicoRow}>
              <View>
                <Text style={styles.tecnicoName}>
                  {response.tecnico.apelido} · {response.tecnico.clube}
                </Text>
              </View>
              <View style={styles.playerRight}>
                <Text style={styles.playerClub}>
                  C$ {response.tecnico.preco.toFixed(2)}
                </Text>
                <Text style={styles.playerPrice}>
                  {response.tecnico.previsto.toFixed(1)}
                  {real !== null ? ` (${real.toFixed(1)})` : ''} pts
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => navigation.navigate('Justificar', { apelido: response.tecnico.apelido, atleta_id: response.tecnico.atleta_id, clube: response.tecnico.clube })}
              >
                <Text style={styles.detailBtnText}>i</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      })()}

      {hasActual && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            Proj: {response.pontos_previstos.toFixed(1)} · Real: {totalReal!.toFixed(1)}
          </Text>
        </View>
      )}

      {Object.keys(response.reservas).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Reservas</Text>
          {Object.entries(response.reservas).map(([pos, r]) => (
            <View key={pos} style={styles.reservaRow}>
              <Text style={styles.reservaPos}>
                {posicoes[pos] || pos}
              </Text>
              <Text style={styles.reservaName}>
                {r.apelido}
                {r.luxo ? ' ⭐' : ''}
              </Text>
            </View>
          ))}
        </>
      )}

      {response.comparacao?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Comparação</Text>
          {response.comparacao.map((c) => (
            <View key={c.formacao} style={styles.compRow}>
              <Text style={styles.compFormacao}>{c.formacao}</Text>
              <Text style={styles.compPts}>{c.pontos_previstos.toFixed(1)} pts</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
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
  inner: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  pickerActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  pesoItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  pesoActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  pickerText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  pickerTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  generateBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  feedback: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  resultFormacao: {
    fontSize: 15,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
  },
  resultOrcamento: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
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
  detailBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  tecnicoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  tecnicoName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  tecnicoClub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  playerLeft: {},
  playerPos: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  playerName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerClub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  playerPrice: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  reservaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  reservaPos: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  reservaName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  compFormacao: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  compPts: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
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
});
