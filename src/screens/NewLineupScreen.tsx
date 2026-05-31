import { useState } from 'react';
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
import { FORMACOES, Lineup, OtimizarParams } from '../types';

const FOCOS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

function labelFoco(v: number): string {
  if (v === 1.0) return 'Só Pontuação';
  if (v >= 0.8) return '↑ Pontuação';
  if (v === 0.7) return 'Valoriz. Leve';
  if (v === 0.5) return 'Equilibrado';
  if (v === 0.3) return '↑ Valorização';
  if (v === 0.0) return 'Só Valorização';
  return v.toFixed(1);
}
import { postOtimizar } from '../services/api';
import { saveLineup } from '../services/storage';

export default function NewLineupScreen({ route, navigation }: any) {
  const rodada = route.params?.rodada ?? 0;

  const [nome, setNome] = useState(`Rodada ${rodada}`);
  const [orcamento, setOrcamento] = useState('100');
  const [formacao, setFormacao] = useState('auto');
  const [perfil, setPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [foco, setFoco] = useState(1.0);
  const [incluirDuvidosos, setIncluirDuvidosos] = useState(false);
  const [reservaLuxo, setReservaLuxo] = useState(true);
  const [obrigarText, setObrigarText] = useState('');
  const [excluirText, setExcluirText] = useState('');
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

    const obrigar = obrigarText.trim() ? obrigarText.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : undefined;
    const excluir = excluirText.trim() ? excluirText.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : undefined;

    const params: OtimizarParams = {
      orcamento: budget,
      formacao,
      perfil,
      foco,
      incluir_duvidosos: incluirDuvidosos,
      reserva_luxo: reservaLuxo,
      ...(obrigar && obrigar.length > 0 && { obrigar }),
      ...(excluir && excluir.length > 0 && { excluir }),
    };

    setError(null);
    setFeedback('Enviando para o servidor...');
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await postOtimizar(params);
      clearTimeout(timeout);
      const valorizacao_total = [
        ...response.players,
        ...(response.tecnico ? [response.tecnico] : []),
      ].reduce((sum, p) => sum + ((p.preco_projetado ?? 0) - p.preco), 0);
      response.valorizacao_total = valorizacao_total;
      const lineup: Lineup = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nome: nome.trim(),
        rodada,
        created_at: new Date().toISOString(),
        params,
        response,
      };
      await saveLineup(lineup);
      navigation.navigate('LineupDetail', { lineup });
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

      <Text style={styles.label}>Foco</Text>
      <Text style={styles.focoHint}>{labelFoco(foco)}</Text>
      <View style={styles.pickerRow}>
        {FOCOS.map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.pesoItem, foco === v && styles.pesoActive]}
            onPress={() => setFoco(v)}
          >
            <Text
              style={[
                styles.pickerText,
                foco === v && styles.pickerTextActive,
              ]}
            >
              {v.toFixed(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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

      <Text style={styles.label}>Obrigar atletas (IDs separados por vírgula)</Text>
      <TextInput
        style={styles.input}
        value={obrigarText}
        onChangeText={setObrigarText}
        placeholder="Ex: 65753, 71234, 78901"
        placeholderTextColor="#64748b"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Excluir atletas (IDs separados por vírgula)</Text>
      <TextInput
        style={styles.input}
        value={excluirText}
        onChangeText={setExcluirText}
        placeholder="Ex: 65753, 71234, 78901"
        placeholderTextColor="#64748b"
        keyboardType="number-pad"
      />

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
  focoHint: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 6,
    fontStyle: 'italic',
  },
});
