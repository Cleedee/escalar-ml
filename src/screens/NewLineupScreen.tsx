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
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import usePageTitle from '../usePageTitle';
import Button from '../components/Button';
import Badge from '../components/Badge';

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

  const [nome, setNome] = useState(route.params?.nome ?? `Rodada ${rodada}`);
  const [orcamento, setOrcamento] = useState(route.params?.orcamento ?? '100');
  const [formacao, setFormacao] = useState(route.params?.formacao ?? 'auto');
  const [perfil, setPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>(route.params?.perfil ?? 'neutro');
  const [foco, setFoco] = useState(route.params?.foco ?? 1.0);
  const [incluirDuvidosos, setIncluirDuvidosos] = useState(route.params?.incluir_duvidosos ?? false);
  const [reservaLuxo, setReservaLuxo] = useState(route.params?.reserva_luxo ?? true);
  const [obrigarText, setObrigarText] = useState(route.params?.obrigarText ?? '');
  const [excluirText, setExcluirText] = useState(route.params?.excluirText ?? '');
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

        <Card>
          <SectionHeader label="Nome" />
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholderTextColor={theme.colors.textMuted}
          />

          <SectionHeader label="Orçamento (C$)" />
          <TextInput
            style={styles.input}
            value={orcamento}
            onChangeText={setOrcamento}
            keyboardType="decimal-pad"
            placeholderTextColor={theme.colors.textMuted}
          />
        </Card>

        <Card>
          <SectionHeader label="Formação" />
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

          <SectionHeader
            label="Perfil de Risco"
            action={
              <TouchableOpacity onPress={() => navigation.navigate('Help')}>
                <Text style={styles.helpBtn}>?</Text>
              </TouchableOpacity>
            }
          />
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

          <SectionHeader
            label="Foco"
            action={
              <TouchableOpacity onPress={() => navigation.navigate('Help')}>
                <Text style={styles.helpBtn}>?</Text>
              </TouchableOpacity>
            }
          />
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
        </Card>

        <Card>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Incluir duvidosos</Text>
            <Switch
              value={incluirDuvidosos}
              onValueChange={setIncluirDuvidosos}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Reserva de luxo</Text>
            <Switch
              value={reservaLuxo}
              onValueChange={setReservaLuxo}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>
        </Card>

        <Card>
          <SectionHeader label="Obrigar atletas" />
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={obrigarText}
              onChangeText={setObrigarText}
              placeholder="IDs separados por vírgula"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('obrigar')}>
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>

          <SectionHeader label="Excluir atletas" />
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={excluirText}
              onChangeText={setExcluirText}
              placeholder="IDs separados por vírgula"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('excluir')}>
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {loading ? (
          <TouchableOpacity
            style={styles.generateBtn}
            disabled
          >
            <ActivityIndicator color="#fff" />
          </TouchableOpacity>
        ) : (
          <Button variant="primary" label="Gerar escalação" onPress={handleGenerate} />
        )}
        {feedback !== '' && (
          <Text style={styles.feedback}>{feedback}</Text>
        )}
        {error !== null && (
          <Text style={styles.errorMsg}>{error}</Text>
        )}

        <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />
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
              placeholderTextColor={theme.colors.textMuted}
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
    backgroundColor: theme.colors.bg,
  },
  inner: {
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  title: {
    fontSize: theme.fontSize['3xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['2xl'],
    marginTop: 2,
  },
  helpBtn: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    width: theme.spacing.xl,
    height: theme.spacing.xl,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    textAlign: 'center',
    lineHeight: 17,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  inputFlex: {
    flex: 1,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: theme.fontSize.xl,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceElevated,
  },
  pickerActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  pesoItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceElevated,
  },
  pesoActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.infoGlow,
  },
  pickerText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  pickerTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.xs,
  },
  switchLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  generateBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: 28,
  },
  feedback: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  errorMsg: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.base,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  focoHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.info,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    padding: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalClose: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
    padding: theme.spacing.xs,
  },
  modalSearch: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  modalList: {
    maxHeight: 400,
  },
  modalEmpty: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
    fontSize: theme.fontSize.base,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  modalItemDetail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalItemId: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
});
