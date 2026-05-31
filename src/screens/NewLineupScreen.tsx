import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartolaAthlete, FORMACOES, Lineup, OtimizarParams } from '../types';
import { fetchMercado, fetchClubes, postOtimizar } from '../services/api';
import { saveLineup } from '../services/storage';

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

const POS_MAP: Record<number, string> = {
  1: 'GOL',
  2: 'LAT',
  3: 'ZAG',
  4: 'MEI',
  5: 'ATA',
  6: 'TEC',
};

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
  const [feedback, setFeedback] = useState('');

  const [mercadoAtletas, setMercadoAtletas] = useState<CartolaAthlete[]>([]);
  const [clubeMap, setClubeMap] = useState<Record<string, string>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'obrigar' | 'excluir'>('obrigar');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([fetchMercado(), fetchClubes()])
      .then(([mercado, clubes]) => {
        setMercadoAtletas(Object.values(mercado.atletas));
        const map: Record<string, string> = {};
        for (const [id, c] of Object.entries(clubes)) {
          map[id] = c.nome;
        }
        setClubeMap(map);
      })
      .catch(() => {});
  }, []);

  const openSearch = useCallback((target: 'obrigar' | 'excluir') => {
    setSearchTarget(target);
    setSearchQuery('');
    setShowSearch(true);
  }, []);

  const selectAthlete = useCallback((athlete: CartolaAthlete) => {
    const idStr = String(athlete.atleta_id);
    if (searchTarget === 'obrigar') {
      setObrigarText((prev) => {
        const ids = prev ? prev.split(',').map(s => s.trim()) : [];
        if (ids.includes(idStr)) return prev;
        return prev ? `${prev}, ${idStr}` : idStr;
      });
    } else {
      setExcluirText((prev) => {
        const ids = prev ? prev.split(',').map(s => s.trim()) : [];
        if (ids.includes(idStr)) return prev;
        return prev ? `${prev}, ${idStr}` : idStr;
      });
    }
    setShowSearch(false);
  }, [searchTarget]);

  const filtered = searchQuery.trim()
    ? mercadoAtletas.filter((a) =>
        a.apelido.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 30)
    : mercadoAtletas.slice(0, 30);

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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
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

        <Text style={styles.label}>Obrigar atletas</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={obrigarText}
            onChangeText={setObrigarText}
            placeholder="IDs separados por vírgula"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('obrigar')}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Excluir atletas</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={excluirText}
            onChangeText={setExcluirText}
            placeholder="IDs separados por vírgula"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('excluir')}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
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

      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {searchTarget === 'obrigar' ? 'Obrigar' : 'Excluir'} — selecione o atleta
              </Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por apelido..."
              placeholderTextColor="#64748b"
              autoFocus
            />
            <ScrollView style={styles.modalList}>
              {filtered.length === 0 ? (
                <Text style={styles.modalEmpty}>Nenhum atleta encontrado</Text>
              ) : (
                filtered.map((a) => (
                  <TouchableOpacity
                    key={a.atleta_id}
                    style={styles.modalItem}
                    onPress={() => selectAthlete(a)}
                  >
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemName}>{a.apelido}</Text>
                      <Text style={styles.modalItemDetail}>
                        {POS_MAP[a.posicao_id] || '?'} · {clubeMap[String(a.clube_id)] || a.clube_id} · C$ {a.preco_num.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.modalItemId}>#{a.atleta_id}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: 18,
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
  focoHint: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 6,
    fontStyle: 'italic',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  modalClose: {
    fontSize: 18,
    color: '#94a3b8',
    padding: 4,
  },
  modalSearch: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 400,
  },
  modalEmpty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  modalItemDetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalItemId: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 8,
  },
});
