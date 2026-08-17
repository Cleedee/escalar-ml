import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CartolaAthlete,
  FORMACOES,
  Lineup,
  OtimizarResponse,
  Player,
  Reserva,
  Tecnico,
  STATUS_MAP,
} from '../types';
import { fetchClubes, fetchMercado, fetchStatus, postProjetar } from '../services/api';
import { saveLineup } from '../services/storage';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import usePageTitle from '../usePageTitle';

const POS_ID: Record<string, number> = { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 5, TEC: 6 };
const POS_LABEL: Record<string, string> = {
  GOL: 'Goleiro', LAT: 'Lateral', ZAG: 'Zagueiro', MEI: 'Meia', ATA: 'Atacante', TEC: 'Técnico',
};

function parseFormacao(formacao: string): { def: number; mei: number; ata: number } {
  const parts = formacao.split('-').map(Number);
  return { def: parts[0] ?? 4, mei: parts[1] ?? 3, ata: parts[2] ?? 3 };
}

function criarSlotsIniciais(formacao: string): Record<string, { label: string; posicoesPermitidas: string[] }> {
  const { def, mei, ata } = parseFormacao(formacao);
  const slots: Record<string, { label: string; posicoesPermitidas: string[] }> = {};
  slots['GOL'] = { label: 'Goleiro', posicoesPermitidas: ['GOL'] };
  for (let i = 1; i <= def; i++) slots[`DEF${i}`] = { label: `Defensor ${i}`, posicoesPermitidas: ['LAT', 'ZAG'] };
  for (let i = 1; i <= mei; i++) slots[`MEI${i}`] = { label: `Meia ${i}`, posicoesPermitidas: ['MEI'] };
  for (let i = 1; i <= ata; i++) slots[`ATA${i}`] = { label: `Atacante ${i}`, posicoesPermitidas: ['ATA'] };
  slots['TEC'] = { label: 'Técnico', posicoesPermitidas: ['TEC'] };
  return slots;
}

const RESERVA_SLOTS = [
  { key: 'RES_GOL', label: 'Reserva GOL', posicoesPermitidas: ['GOL'] },
  { key: 'RES_LAT', label: 'Reserva LAT', posicoesPermitidas: ['LAT'] },
  { key: 'RES_ZAG', label: 'Reserva ZAG', posicoesPermitidas: ['ZAG'] },
  { key: 'RES_MEI', label: 'Reserva MEI', posicoesPermitidas: ['MEI'] },
  { key: 'RES_ATA', label: 'Reserva ATA', posicoesPermitidas: ['ATA'] },
];

function getPosIdsFromPermitidas(permitidas: string[]): number[] {
  return permitidas.map((p) => POS_ID[p]).filter((id) => id != null);
}

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

export default function DraftScreen({ route, navigation }: any) {
  usePageTitle('Montar na Mão');
  const rodada = route.params?.rodada ?? 0;

  const [formacao, setFormacao] = useState('4-3-3');
  const [nome, setNome] = useState(route.params?.nome ?? `Rodada ${rodada}`);
  const [orcamento, setOrcamento] = useState(route.params?.orcamento ?? '100');
  const [perfil, setPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [foco, setFoco] = useState(1.0);
  const [reservaLuxo, setReservaLuxo] = useState(false);
  const [reservaLuxoPos, setReservaLuxoPos] = useState('');

  // Slots: starter key → CartolaAthlete | null
  const [starterSlots, setStarterSlots] = useState<Record<string, CartolaAthlete | null>>({});
  // Slots: reserve key → CartolaAthlete | null
  const [reservaSlots, setReservaSlots] = useState<Record<string, CartolaAthlete | null>>({});
  const [capitaoKey, setCapitaoKey] = useState<string | null>(null);

  const [mercadoAtletas, setMercadoAtletas] = useState<CartolaAthlete[]>([]);
  const [clubeMap, setClubeMap] = useState<Record<string, string>>({});
  const [statusMercado, setStatusMercado] = useState<number>(1);
  const [loadingData, setLoadingData] = useState(true);

  // Slot search modal
  const [showSlotSearch, setShowSlotSearch] = useState(false);
  const [searchingSlot, setSearchingSlot] = useState<{ key: string; label: string; permitidas: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [projetando, setProjetando] = useState(false);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);

  const slotDefs = useMemo(() => criarSlotsIniciais(formacao), [formacao]);
  const allSlotKeys = Object.keys(slotDefs);

  // Load market data
  useEffect(() => {
    Promise.all([fetchMercado(), fetchClubes(), fetchStatus()])
      .then(([mercado, clubes, status]) => {
        setMercadoAtletas(Object.values(mercado.atletas));
        const map: Record<string, string> = {};
        for (const [id, c] of Object.entries(clubes)) map[id] = c.nome;
        setClubeMap(map);
        setStatusMercado(status.status_mercado);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  // When formation changes, adjust starter slots
  useEffect(() => {
    setStarterSlots((prev) => {
      const novos: Record<string, CartolaAthlete | null> = {};
      for (const key of Object.keys(slotDefs)) {
        novos[key] = prev[key] ?? null;
      }
      // If captain key no longer exists, clear it
      if (capitaoKey && !novos[capitaoKey]) setCapitaoKey(null);
      return novos;
    });
  }, [formacao]);

  // Calculate used budget
  const orcamentoUsado = useMemo(() => {
    let total = 0;
    for (const a of Object.values(starterSlots)) {
      if (a) total += a.preco_num;
    }
    for (const a of Object.values(reservaSlots)) {
      if (a) total += a.preco_num;
    }
    return total;
  }, [starterSlots, reservaSlots]);

  const orcamentoNum = parseFloat(orcamento) || 0;
  const estouraOrcamento = orcamentoUsado > orcamentoNum + 0.001;

  // Check if all starter slots filled
  const todosStartersPreenchidos = allSlotKeys.every((key) => starterSlots[key] != null);

  // Find athlete in mercado by ID
  const getAthleteById = useCallback(
    (id: number) => mercadoAtletas.find((a) => a.atleta_id === id),
    [mercadoAtletas],
  );

  // Open slot search
  const openSlotSearch = (key: string, label: string, permitidas: string[]) => {
    setSearchingSlot({ key, label, permitidas });
    setSearchQuery('');
    setShowSlotSearch(true);
  };

  // Select athlete from modal
  const selectAthlete = (athlete: CartolaAthlete) => {
    if (!searchingSlot) return;
    const isReservaSlot = searchingSlot.key.startsWith('RES_');
    if (isReservaSlot) {
      setReservaSlots((prev) => ({ ...prev, [searchingSlot.key]: athlete }));
    } else {
      setStarterSlots((prev) => ({ ...prev, [searchingSlot.key]: athlete }));
    }
    setShowSlotSearch(false);
    setSearchingSlot(null);
  };

  // Remove athlete from slot
  const removeAthlete = (key: string) => {
    const isReservaSlot = key.startsWith('RES_');
    if (isReservaSlot) {
      setReservaSlots((prev) => ({ ...prev, [key]: null }));
    } else {
      setStarterSlots((prev) => ({ ...prev, [key]: null }));
      if (capitaoKey === key) setCapitaoKey(null);
    }
  };

  // Filtered athletes for the search modal
  const filteredAthletes = useMemo(() => {
    if (!searchingSlot) return [];
    const posIds = getPosIdsFromPermitidas(searchingSlot.permitidas);
    const list = mercadoAtletas.filter((a) => posIds.includes(a.posicao_id));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list.sort((a, b) => b.preco_num - a.preco_num).slice(0, 40);
    return list
      .filter((a) => a.apelido.toLowerCase().includes(q))
      .sort((a, b) => b.preco_num - a.preco_num)
      .slice(0, 40);
  }, [mercadoAtletas, searchingSlot, searchQuery]);

  // Build the lineup from current selections
  const buildLineup = (): { players: Player[]; tecnico: Tecnico; reservas: Record<string, Reserva>; formacao: string; orcamento_usado: number } => {
    const players: Player[] = [];
    let tecnico: Tecnico = { apelido: '', clube: '', atleta_id: 0, preco: 0, previsto: 0 };
    const reservas: Record<string, Reserva> = {};

    const clubeNome = (clubeId: number | string) => clubeMap[String(clubeId)] || String(clubeId);

    for (const [key, atleta] of Object.entries(starterSlots)) {
      if (!atleta) continue;
      const isTec = atleta.posicao_id === 6;
      const pos = Object.entries(POS_ID).find(([, v]) => v === atleta.posicao_id)?.[0] ?? 'MEI';

      if (isTec) {
        tecnico = {
          apelido: atleta.apelido,
          clube: clubeNome(atleta.clube_id),
          atleta_id: atleta.atleta_id,
          preco: atleta.preco_num,
          previsto: atleta.media_num,
          media_num: atleta.media_num,
          jogos_num: atleta.jogos_num,
        };
      } else {
        players.push({
          atleta_id: atleta.atleta_id,
          apelido: atleta.apelido,
          posicao: pos,
          preco: atleta.preco_num,
          previsto: atleta.media_num,
          clube: clubeNome(atleta.clube_id),
          role: capitaoKey === key ? 'capitao' : undefined,
          media_num: atleta.media_num,
          jogos_num: atleta.jogos_num,
          variacao_num: atleta.variacao_num,
        });
      }
    }

    for (const [key, atleta] of Object.entries(reservaSlots)) {
      if (!atleta) continue;
      const pos = Object.entries(POS_ID).find(([, v]) => v === atleta.posicao_id)?.[0] ?? 'MEI';
      reservas[pos] = {
        atleta_id: atleta.atleta_id,
        apelido: atleta.apelido,
        clube: clubeNome(atleta.clube_id),
        posicao: pos,
        preco: atleta.preco_num,
        previsto: atleta.media_num,
        media_num: atleta.media_num,
        jogos_num: atleta.jogos_num,
        variacao_num: atleta.variacao_num,
        potential_valorizacao: 0,
        preco_projetado: atleta.preco_num,
        tendencia: '',
        eficiencia: 0,
        luxo: reservaLuxo && reservaLuxoPos === key,
      };
    }

    const usado = players.reduce((s, p) => s + p.preco, 0) + tecnico.preco +
      Object.values(reservas).reduce((s, r) => s + r.preco, 0);

    return { players, tecnico, reservas, formacao, orcamento_usado: usado };
  };

  // Projetar
  const handleProjetar = async () => {
    if (!todosStartersPreenchidos) {
      Alert.alert('Incompleto', 'Preencha todos os titulares e o técnico antes de projetar.');
      return;
    }
    if (estouraOrcamento) {
      Alert.alert('Orçamento excedido', `C$ ${orcamentoUsado.toFixed(2)} usados de C$ ${orcamentoNum.toFixed(2)}. Ajuste o orçamento ou troque jogadores.`);
      return;
    }
    const { players, tecnico, reservas, formacao: fmt, orcamento_usado: usado } = buildLineup();
    if (players.length === 0 || !tecnico.atleta_id) {
      Alert.alert('Incompleto', 'É necessário pelo menos 1 titular e 1 técnico.');
      return;
    }

    setProjetando(true);
    try {
      const capitaoId = capitaoKey ? starterSlots[capitaoKey]?.atleta_id : undefined;

      const projetada = await postProjetar({
        atletas: players.map((p) => p.atleta_id),
        tecnico_id: tecnico.atleta_id,
        capitao_id: capitaoId ?? 0,
        rodada,
        forcar: false,
      });

      // Merge projected data into players
      const enrichedPlayers: Player[] = (projetada.jogadores ?? []).map((j: any) => {
        const orig = players.find((p) => p.atleta_id === Number(j.atleta_id));
        return { ...orig, ...j, role: orig?.role };
      });

      const response: OtimizarResponse = {
        formacao: fmt,
        pontos_previstos: projetada.pontos_previstos,
        orcamento_usado: usado,
        players: enrichedPlayers,
        tecnico: projetada.tecnico ?? tecnico,
        reservas,
        comparacao: [],
        valorizacao_total: projetada.valorizacao_total,
      };

      const lineup: Lineup = {
        id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nome: nome.trim(),
        rodada,
        created_at: new Date().toISOString(),
        source: 'draft',
        projetado: true,
        params: {
          orcamento: orcamentoNum,
          formacao: fmt,
          perfil,
          foco,
          incluir_duvidosos: false,
          reserva_luxo: reservaLuxo,
        },
        response,
      };
      await saveLineup(lineup);
      navigation.replace('LineupDetail', { lineup });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao projetar escalação.');
    } finally {
      setProjetando(false);
    }
  };

  // Salvar rascunho (sem projetar)
  const handleSalvarRascunho = async () => {
    if (!todosStartersPreenchidos) {
      Alert.alert('Incompleto', 'Preencha todos os titulares e o técnico antes de salvar.');
      return;
    }
    if (estouraOrcamento) {
      Alert.alert('Orçamento excedido', `C$ ${orcamentoUsado.toFixed(2)} usados de C$ ${orcamentoNum.toFixed(2)}. Ajuste o orçamento ou troque jogadores.`);
      return;
    }
    setSalvandoRascunho(true);
    try {
      const { players, tecnico, reservas, formacao: fmt, orcamento_usado: usado } = buildLineup();
      const response: OtimizarResponse = {
        formacao: fmt,
        pontos_previstos: players.reduce((s, p) => s + (p.media_num ?? 0), 0) + (tecnico.media_num ?? 0),
        orcamento_usado: usado,
        players,
        tecnico,
        reservas,
        comparacao: [],
      };
      const lineup: Lineup = {
        id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nome: nome.trim(),
        rodada,
        created_at: new Date().toISOString(),
        source: 'draft',
        projetado: false,
        params: {
          orcamento: orcamentoNum,
          formacao: fmt,
          perfil,
          foco,
          incluir_duvidosos: false,
          reserva_luxo: reservaLuxo,
        },
        response,
      };
      await saveLineup(lineup);
      Alert.alert('Rascunho salvo', 'Escalação salva como rascunho. Você pode projetá-la depois no detalhe.');
      navigation.replace('LineupDetail', { lineup });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao salvar rascunho.');
    } finally {
      setSalvandoRascunho(false);
    }
  };

  // Render a single slot
  const renderSlot = (key: string, label: string, permitidas: string[], isReserva: boolean) => {
    const atleta = isReserva ? reservaSlots[key] : starterSlots[key];
    const isCap = capitaoKey === key;

    return (
      <View key={key} style={styles.slot}>
        <View style={styles.slotLeft}>
          <Text style={styles.slotLabel}>{label}</Text>
          {atleta ? (
            <View style={styles.slotFilled}>
              <Text style={styles.slotPlayer}>{atleta.apelido}</Text>
              <Text style={styles.slotDetail}>
                {clubeMap[String(atleta.clube_id)] || atleta.clube_id} · C$ {atleta.preco_num.toFixed(2)} · média {atleta.media_num.toFixed(1)}
              </Text>
              <View style={styles.slotActions}>
                {!isReserva && (
                  <TouchableOpacity
                    style={[styles.slotCapBtn, isCap && styles.slotCapBtnActive]}
                    onPress={() => setCapitaoKey(isCap ? null : key)}
                  >
                    <Text style={[styles.slotCapText, isCap && styles.slotCapTextActive]}>
                      {isCap ? '⭐ Capitão' : '☆ Capitão'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.slotEmpty} onPress={() => openSlotSearch(key, label, permitidas)}>
              <Text style={styles.slotEmptyText}>+ {isReserva ? 'Selecione' : `Selecione o ${label.toLowerCase()}`}</Text>
            </TouchableOpacity>
          )}
        </View>
        {atleta && (
          <View style={styles.slotRight}>
            <TouchableOpacity style={styles.slotSwapBtn} onPress={() => openSlotSearch(key, label, permitidas)}>
              <Text style={styles.slotSwapText}>⇄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.slotRemoveBtn} onPress={() => removeAthlete(key)}>
              <Text style={styles.slotRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const mercadoFechado = statusMercado !== 1;

  if (loadingData) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Montar na Mão</Text>
        <Text style={styles.subtitle}>Rodada {rodada}</Text>

        {mercadoFechado && (
          <Card style={styles.marketBanner}>
            <View style={styles.marketBannerRow}>
              <Text style={styles.marketBannerIcon}>⚠️</Text>
              <View style={styles.marketBannerBody}>
                <Text style={styles.marketBannerTitle}>Mercado fechado</Text>
                <Text style={styles.marketBannerText}>
                  {STATUS_MAP[statusMercado]?.label ?? 'Status desconhecido'} — os preços e médias são do último snapshot.
                  Você pode montar o time agora e escalá-lo no app oficial, ou projetar para ver as estimativas.
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

          <SectionHeader label="Formação" />
          <View style={styles.pickerRow}>
            {FORMACOES.filter((f) => f !== 'auto').map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.pickerItem, formacao === f && styles.pickerActive]}
                onPress={() => setFormacao(f)}
              >
                <Text style={[styles.pickerText, formacao === f && styles.pickerTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <SectionHeader label="Titulares e Técnico" />
          {allSlotKeys.map((key) => {
            const def = slotDefs[key];
            return renderSlot(key, def.label, def.posicoesPermitidas, false);
          })}
        </Card>

        <Card>
          <SectionHeader label="Reservas" />
          <Text style={styles.hintText}>
            Selecione até 5 reservas (uma por posição). A reserva de luxo substitui o pior titular pós-rodada.
          </Text>
          {RESERVA_SLOTS.map((rs) => renderSlot(rs.key, rs.label, rs.posicoesPermitidas, true))}

          {Object.values(reservaSlots).some((a) => a != null) && (
            <View style={styles.luxoRow}>
              <Text style={styles.luxoLabel}>Reserva de luxo:</Text>
              <View style={styles.pickerRow}>
                {Object.entries(reservaSlots)
                  .filter(([, a]) => a != null)
                  .map(([key, atleta]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.luxoItem, reservaLuxo && reservaLuxoPos === key && styles.luxoItemActive]}
                      onPress={() => {
                        if (reservaLuxo && reservaLuxoPos === key) {
                          setReservaLuxo(false);
                          setReservaLuxoPos('');
                        } else {
                          setReservaLuxo(true);
                          setReservaLuxoPos(key);
                        }
                      }}
                    >
                      <Text style={[styles.luxoItemText, reservaLuxo && reservaLuxoPos === key && styles.luxoItemTextActive]}>
                        {atleta!.apelido}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}
        </Card>

        {/* Budget bar */}
        <Card style={styles.budgetCard}>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Orçamento</Text>
            <Text style={[styles.budgetValue, estouraOrcamento && styles.budgetOver]}>
              C$ {orcamentoUsado.toFixed(2)} / C$ {orcamentoNum.toFixed(2)}
            </Text>
          </View>
          <View style={styles.budgetBarBg}>
            <View
              style={[
                styles.budgetBarFill,
                {
                  width: `${orcamentoNum > 0 ? Math.min((orcamentoUsado / orcamentoNum) * 100, 100) : 0}%`,
                  backgroundColor: estouraOrcamento ? theme.colors.danger : theme.colors.primary,
                },
              ]}
            />
          </View>
          {estouraOrcamento && (
            <Text style={styles.budgetOverText}>Orçamento excedido!</Text>
          )}
        </Card>

        {/* Summary info */}
        {todosStartersPreenchidos && (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo</Text>
            <Text style={styles.summaryText}>
              {allSlotKeys.filter((k) => k !== 'TEC').length} titulares + 1 técnico
              {Object.values(reservaSlots).filter((a) => a != null).length > 0
                ? ` + ${Object.values(reservaSlots).filter((a) => a != null).length} reservas`
                : ''}
              {' · '}C$ {orcamentoUsado.toFixed(2)} usados
              {capitaoKey && starterSlots[capitaoKey]
                ? ` · Capitão: ${starterSlots[capitaoKey]!.apelido}`
                : ' · Sem capitão'}
            </Text>
          </Card>
        )}

        <Button
          variant="primary"
          label={projetando ? 'Projetando...' : 'Projetar escalação'}
          onPress={handleProjetar}
          disabled={!todosStartersPreenchidos || estouraOrcamento || projetando}
        />
        <Button
          variant="outline"
          label={salvandoRascunho ? 'Salvando...' : 'Salvar rascunho'}
          onPress={handleSalvarRascunho}
          disabled={!todosStartersPreenchidos || estouraOrcamento || salvandoRascunho}
        />
        <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />
      </ScrollView>

      {/* Slot search modal */}
      <Modal visible={showSlotSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTitle}>
                  {searchingSlot ? searchingSlot.label : 'Selecionar'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {searchingSlot ? searchingSlot.permitidas.join(' / ') : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowSlotSearch(false); setSearchingSlot(null); }}>
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
              {filteredAthletes.length === 0 ? (
                <Text style={styles.modalEmpty}>Nenhum atleta encontrado</Text>
              ) : (
                filteredAthletes.map((a) => {
                  const pos = Object.entries(POS_ID).find(([, v]) => v === a.posicao_id)?.[0] ?? '?';
                  const posLabel = POS_LABEL[pos] || pos;
                  return (
                    <TouchableOpacity
                      key={a.atleta_id}
                      style={styles.modalItem}
                      onPress={() => selectAthlete(a)}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={styles.modalItemName}>{a.apelido}</Text>
                        <Text style={styles.modalItemDetail}>
                          {posLabel} · {clubeMap[String(a.clube_id)] || a.clube_id} · C$ {a.preco_num.toFixed(2)} · média {a.media_num.toFixed(1)}
                        </Text>
                      </View>
                      <Text style={styles.modalItemArrow}>+</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { padding: theme.spacing.xl, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  pickerText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  pickerTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  slot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  slotLeft: { flex: 1 },
  slotLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wide,
    marginBottom: 4,
  },
  slotEmpty: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderStyle: 'dashed',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  slotEmptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  slotFilled: { paddingVertical: theme.spacing.xs },
  slotPlayer: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  slotDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  slotActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  slotCapBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  slotCapBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(217,70,239,0.1)',
  },
  slotCapText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
  slotCapTextActive: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.bold,
  },
  slotRight: { flexDirection: 'row', gap: theme.spacing.xs, marginLeft: theme.spacing.sm, marginTop: 20 },
  slotSwapBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  slotSwapText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  slotRemoveBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotRemoveText: { color: theme.colors.danger, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  hintText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: theme.spacing.xl,
  },
  luxoRow: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  luxoLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  luxoItem: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1, borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  luxoItemActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(217,70,239,0.1)',
  },
  luxoItemText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  luxoItemTextActive: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.bold,
  },
  budgetCard: { marginTop: theme.spacing.md },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  budgetLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  budgetValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
  },
  budgetOver: { color: theme.colors.danger },
  budgetBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetOverText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  summaryCard: { marginBottom: theme.spacing.md },
  summaryTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wider,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  summaryText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: theme.spacing.xl,
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
  marketBannerIcon: { fontSize: theme.fontSize.xl },
  marketBannerBody: { flex: 1 },
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
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  modalHeaderLeft: { flex: 1 },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  modalSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
  modalList: { maxHeight: 400 },
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
  modalItemLeft: { flex: 1 },
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
  modalItemArrow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    marginLeft: theme.spacing.sm,
  },
});