import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CartolaAthlete, FORMACOES, League, Lineup, OtimizarParams, Perfil, STATUS_MAP } from '../types';
import { fetchClubes, fetchMercado, fetchStatus, postOtimizar } from '../services/api';
import { getLeagues, saveLineup } from '../services/storage';
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

const PERFIL_DESC: Record<string, string> = {
  neutro: 'Equilíbrio entre pontuação e valorização.',
  agressivo: 'Busca upside: assume mais risco por pontos altos.',
  conservador: 'Prefere atletas com alta chance de jogar.',
  upside: 'Alto risco, alto retorno: atletas de picos altos.',
};

function parseIds(text: string): number[] {
  return text.trim() ? text.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : [];
}

/** Custo do time mais barato possível do mercado: 1 GOL + 2 def + 2 MEI + 1 ATA + 1 TEC. */
function calcOrcamentoMinimo(atletas: CartolaAthlete[]): number | null {
  if (atletas.length === 0) return null;
  const byPos = (pos: number) =>
    atletas.filter((a) => a.posicao_id === pos).sort((a, b) => a.preco_num - b.preco_num);
  const gol = byPos(1)[0];
  const defs = [...byPos(2), ...byPos(3)].sort((a, b) => a.preco_num - b.preco_num).slice(0, 2);
  const meis = byPos(4).slice(0, 2);
  const ata = byPos(5)[0];
  const tec = byPos(6)[0];
  if (!gol || defs.length < 2 || meis.length < 2 || !ata || !tec) return null;
  return (
    gol.preco_num +
    defs.reduce((s, a) => s + a.preco_num, 0) +
    meis.reduce((s, a) => s + a.preco_num, 0) +
    ata.preco_num +
    tec.preco_num
  );
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
  const [perfil, setPerfil] = useState<Perfil>(route.params?.perfil ?? 'neutro');
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
  const [statusMercado, setStatusMercado] = useState<number>(1);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [atribuidoTeamId, setAtribuidoTeamId] = useState<string | undefined>(undefined);
  const [showAtribuir, setShowAtribuir] = useState(false);
  const [expandedLiga, setExpandedLiga] = useState<string | null>(null);

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
    fetchStatus()
      .then((s) => setStatusMercado(s.status_mercado))
      .catch(() => {});
    getLeagues().then(setLeagues).catch(() => {});
  }, []);

  const openSearch = useCallback((target: 'obrigar' | 'excluir') => {
    setSearchTarget(target);
    setSearchQuery('');
    setShowSearch(true);
  }, []);

  const selectAthlete = useCallback((athlete: CartolaAthlete) => {
    const idStr = String(athlete.atleta_id);
    if (searchTarget === 'obrigar') {
      setObrigarText((prev: string) => {
        const ids = prev ? prev.split(',').map((s: string) => s.trim()) : [];
        if (ids.includes(idStr)) return prev;
        return prev ? `${prev}, ${idStr}` : idStr;
      });
    } else {
      setExcluirText((prev: string) => {
        const ids = prev ? prev.split(',').map((s: string) => s.trim()) : [];
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

  const mercadoIds = useMemo(() => new Set(mercadoAtletas.map((a) => a.atleta_id)), [mercadoAtletas]);
  const minOrcamento = useMemo(() => calcOrcamentoMinimo(mercadoAtletas), [mercadoAtletas]);
  const invalidObrigar = useMemo(() => parseIds(obrigarText).filter((id) => !mercadoIds.has(id)), [obrigarText, mercadoIds]);
  const invalidExcluir = useMemo(() => parseIds(excluirText).filter((id) => !mercadoIds.has(id)), [excluirText, mercadoIds]);
  const atribuido = useMemo(() => {
    for (const liga of leagues) {
      const t = liga.times.find((tm) => tm.id === atribuidoTeamId);
      if (t) return { team: t.nome, league: liga.nome };
    }
    return null;
  }, [leagues, atribuidoTeamId]);
  const mercadoFechado = statusMercado !== 1;

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
    if (minOrcamento !== null && budget < minOrcamento) {
      Alert.alert(
        'Orçamento baixo',
        `Com C$ ${budget.toFixed(2)} fica difícil montar um time completo: o time mínimo do mercado custa C$ ${minOrcamento.toFixed(2)} (1 GOL + 2 def + 2 MEI + 1 ATA + 1 técnico). Ajuste o orçamento.`,
      );
      return;
    }
    const invalidIds = [...invalidObrigar, ...invalidExcluir];
    if (invalidIds.length > 0) {
      Alert.alert(
        'IDs inválidos',
        `Estes IDs não existem no mercado atual: ${invalidIds.join(', ')}. Use a busca (🔍) para selecionar atletas válidos.`,
      );
      return;
    }

    const obrigar = parseIds(obrigarText);
    const excluir = parseIds(excluirText);

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
        ...(atribuidoTeamId ? { atribuido_a_team_id: atribuidoTeamId } : {}),
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

        {mercadoFechado && (
          <Card style={styles.marketBanner}>
            <View style={styles.marketBannerRow}>
              <Text style={styles.marketBannerIcon}>⚠️</Text>
              <View style={styles.marketBannerBody}>
                <Text style={styles.marketBannerTitle}>Mercado fechado</Text>
                <Text style={styles.marketBannerText}>
                  {STATUS_MAP[statusMercado]?.label ?? 'Status desconhecido'} — as projeções usam o
                  último snapshot (preços congelados no fechamento). Você ainda pode gerar, importar
                  do Cartola ou editar escalações existentes.
                </Text>
              </View>
            </View>
          </Card>
        )}

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
          {minOrcamento !== null && (
            <Text style={styles.hintText}>
              Time mínimo do mercado: C$ {minOrcamento.toFixed(2)} (1 GOL + 2 def + 2 MEI + 1 ATA + técnico)
            </Text>
          )}
        </Card>

        <Card>
          <SectionHeader label="Atribuir a time da liga (opcional)" />
          <TouchableOpacity style={styles.atribuirBtn} onPress={() => setShowAtribuir(true)}>
            <Text style={[styles.atribuirBtnText, atribuido ? undefined : styles.atribuirBtnTextEmpty]}>
              {atribuido ? `${atribuido.team} · ${atribuido.league}` : 'Nenhum time selecionado'}
            </Text>
            <Text style={styles.atribuirBtnAction}>{atribuido ? 'Alterar' : 'Selecionar'}</Text>
          </TouchableOpacity>
          {atribuido && (
            <TouchableOpacity onPress={() => setAtribuidoTeamId(undefined)}>
              <Text style={styles.atribuirRemover}>Remover atribuição</Text>
            </TouchableOpacity>
          )}
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
          <Text style={styles.hintText}>{PERFIL_DESC[perfil] ?? ''}</Text>
          <View style={styles.pickerRow}>
            {(['neutro', 'agressivo', 'conservador', 'upside'] as const).map((p) => (
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
                  {p === 'neutro' ? 'Neutro' : p === 'agressivo' ? 'Agressivo' : p === 'conservador' ? 'Conservador' : 'Upside'}
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
          <Text style={styles.hintText}>
            Quanto maior o foco, mais o otimizador prioriza pontuação; menor, prioriza valorização (0–1).
          </Text>
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
              style={[styles.input, styles.inputFlex, invalidObrigar.length > 0 && styles.inputInvalid]}
              value={obrigarText}
              onChangeText={setObrigarText}
              placeholder="IDs separados por vírgula"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('obrigar')}>
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
          {invalidObrigar.length > 0 && (
            <Text style={styles.invalidText}>
              IDs inexistentes no mercado: {invalidObrigar.join(', ')}
            </Text>
          )}

          <SectionHeader label="Excluir atletas" />
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex, invalidExcluir.length > 0 && styles.inputInvalid]}
              value={excluirText}
              onChangeText={setExcluirText}
              placeholder="IDs separados por vírgula"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('excluir')}>
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
          {invalidExcluir.length > 0 && (
            <Text style={styles.invalidText}>
              IDs inexistentes no mercado: {invalidExcluir.join(', ')}
            </Text>
          )}
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

        <Button variant="outline" label="✏ Montar na mão" onPress={() => navigation.navigate('Draft', { rodada })} />
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

      <Modal visible={showAtribuir} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atribuir escalação a um time</Text>
              <TouchableOpacity onPress={() => setShowAtribuir(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {leagues.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  Nenhuma liga cadastrada. Crie uma liga na aba Ligas.
                </Text>
              ) : (
                leagues.map((liga) => (
                  <View key={liga.id}>
                    <TouchableOpacity
                      style={styles.ligaRow}
                      onPress={() => setExpandedLiga(expandedLiga === liga.id ? null : liga.id)}
                    >
                      <Text style={styles.ligaNome}>{liga.nome}</Text>
                      <Text style={styles.ligaArrow}>{expandedLiga === liga.id ? '▾' : '▸'}</Text>
                    </TouchableOpacity>
                    {expandedLiga === liga.id &&
                      liga.times.map((time) => (
                        <TouchableOpacity
                          key={time.id}
                          style={styles.timeRow}
                          onPress={() => {
                            setAtribuidoTeamId(time.id);
                            setShowAtribuir(false);
                            setExpandedLiga(null);
                          }}
                        >
                          <Text style={styles.timeNome}>{time.nome}</Text>
                          <Text style={styles.timeProp}>{time.proprietario}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
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
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['2xl'],
    marginTop: 2,
  },
  helpBtn: {
    fontFamily: theme.fonts.body,
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
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  generateBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: 28,
  },
  feedback: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  errorMsg: {
    fontFamily: theme.fonts.body,
    color: theme.colors.danger,
    fontSize: theme.fontSize.base,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  focoHint: {
    fontFamily: theme.fonts.body,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    borderBottomColor: theme.colors.border,
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  modalItemDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalItemId: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  marketBanner: {
    borderColor: theme.colors.warning,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  marketBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  marketBannerIcon: {
    fontSize: theme.fontSize.xl,
  },
  marketBannerBody: {
    flex: 1,
  },
  marketBannerTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.warning,
    marginBottom: 2,
  },
  marketBannerText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.spacing.xl,
  },
  hintText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  invalidText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  inputInvalid: {
    borderColor: theme.colors.danger,
  },
  atribuirBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  atribuirBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    flex: 1,
  },
  atribuirBtnTextEmpty: {
    color: theme.colors.textMuted,
  },
  atribuirBtnAction: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  atribuirRemover: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-end',
  },
  ligaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ligaNome: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  ligaArrow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  timeRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  timeNome: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
  },
  timeProp: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
