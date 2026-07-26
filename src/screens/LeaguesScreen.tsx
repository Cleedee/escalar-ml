import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';
import { League } from '../types';
import { deleteLeague, getLeagues, saveLeague } from '../services/storage';
import { fetchStatus } from '../services/api';
import usePageTitle from '../usePageTitle';

const RODADAS = Array.from({ length: 38 }, (_, i) => i + 1);

export default function LeaguesScreen({ navigation }: any) {
  usePageTitle('Ligas');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copiarOrigem, setCopiarOrigem] = useState<League | null>(null);
  const [copiaNome, setCopiaNome] = useState('');
  const [nome, setNome] = useState('');
  const [modalidade, setModalidade] = useState<'patrimonio' | 'pontuacao'>('pontuacao');
  const [rodadaInicial, setRodadaInicial] = useState(1);
  const [rodadaFinal, setRodadaFinal] = useState(1);
  const [rodadaAtual, setRodadaAtual] = useState(1);

  useFocusEffect(
    useCallback(() => {
      getLeagues().then(setLeagues);
    }, [])
  );

  useEffect(() => {
    fetchStatus().then((s) => {
      setRodadaAtual(s.rodada_atual);
      setRodadaInicial(s.rodada_atual);
      setRodadaFinal(s.rodada_atual);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    if (rodadaInicial > rodadaFinal) return;
    const league: League = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      rodada_inicial: rodadaInicial,
      rodada_final: rodadaFinal,
      modalidade,
      times: [],
      created_at: new Date().toISOString(),
    };
    await saveLeague(league);
    setNome('');
    setShowForm(false);
    setLeagues(await getLeagues());
  };

  const handleDelete = (id: string) => {
    deleteLeague(id).then(() => getLeagues().then(setLeagues));
  };

  const openCopy = (league: League) => {
    setCopiarOrigem(league);
    setCopiaNome(`${league.nome} (cópia)`);
    setShowCopy(true);
  };

  const handleCopy = async () => {
    if (!copiarOrigem || !copiaNome.trim()) return;
    const league: League = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: copiaNome.trim(),
      rodada_inicial: copiarOrigem.rodada_inicial,
      rodada_final: copiarOrigem.rodada_final,
      modalidade: copiarOrigem.modalidade,
      times: copiarOrigem.times.map((t) => ({
        ...t,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      })),
      created_at: new Date().toISOString(),
    };
    await saveLeague(league);
    setCopiaNome('');
    setShowCopy(false);
    setCopiarOrigem(null);
    setLeagues(await getLeagues());
  };

  const openForm = () => {
    setRodadaInicial(rodadaAtual);
    setRodadaFinal(rodadaAtual);
    setShowForm(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ligas</Text>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma liga ainda</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('LeagueDetail', { league: item })}
            activeOpacity={0.8}
          >
            <Card>
              <View style={styles.cardTop}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                <Text style={styles.cardModalidade}>
                  {item.modalidade === 'pontuacao' ? 'Pontuação' : 'Patrimônio'}
                </Text>
              </View>
              <Text style={styles.cardRodadas}>
                R{item.rodada_inicial}{item.rodada_final !== item.rodada_inicial ? ` a R${item.rodada_final}` : ''} · {item.rodada_final - item.rodada_inicial + 1} rodada{item.rodada_final !== item.rodada_inicial ? 's' : ''}
              </Text>
              <Text style={styles.cardTimes}>
                {item.times.length} time{item.times.length !== 1 ? 's' : ''}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openCopy(item)}>
                  <Text style={styles.copyBtnText}>Copiar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={styles.deleteBtnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <Button variant="primary" label="+ Nova Liga" onPress={openForm} />

      <Modal visible={showForm} transparent animationType="fade">
          <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Liga</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Liga dos Amigos"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.label}>Rodada Inicial</Text>
            <View style={styles.pickerRow}>
              {RODADAS.filter((r) => r <= rodadaFinal).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.pickerItemSm, rodadaInicial === r && styles.pickerActive]}
                  onPress={() => setRodadaInicial(r)}
                >
                  <Text style={[styles.pickerTextSm, rodadaInicial === r && styles.pickerTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Rodada Final</Text>
            <View style={styles.pickerRow}>
              {RODADAS.filter((r) => r >= rodadaInicial).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.pickerItemSm, rodadaFinal === r && styles.pickerActive]}
                  onPress={() => setRodadaFinal(r)}
                >
                  <Text style={[styles.pickerTextSm, rodadaFinal === r && styles.pickerTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rodadaInicial === rodadaFinal && (
              <Text style={styles.hint}>Liga de rodada única (R{rodadaInicial})</Text>
            )}
            {rodadaFinal > rodadaInicial && (
              <Text style={styles.hint}>Liga com {rodadaFinal - rodadaInicial + 1} rodadas (R{rodadaInicial} a R{rodadaFinal})</Text>
            )}

            <Text style={styles.label}>Modalidade</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerItem, modalidade === 'pontuacao' && styles.pickerActive]}
                onPress={() => setModalidade('pontuacao')}
              >
                <Text style={[styles.pickerText, modalidade === 'pontuacao' && styles.pickerTextActive]}>
                  Pontuação
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerItem, modalidade === 'patrimonio' && styles.pickerActive]}
                onPress={() => setModalidade('patrimonio')}
              >
                <Text style={[styles.pickerText, modalidade === 'patrimonio' && styles.pickerTextActive]}>
                  Patrimônio
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
                <Text style={styles.confirmBtnText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCopy} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Copiar Liga</Text>

            <Text style={styles.label}>Nome da nova liga</Text>
            <TextInput
              style={styles.input}
              value={copiaNome}
              onChangeText={setCopiaNome}
              placeholderTextColor={theme.colors.textMuted}
            />

            {copiarOrigem && (
              <Text style={styles.hint}>
                Serão copiados {copiarOrigem.times.length} time{copiarOrigem.times.length !== 1 ? 's' : ''}, as rodadas e a modalidade. As escalações não serão copiadas.
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCopy(false); setCopiarOrigem(null); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCopy}>
                <Text style={styles.confirmBtnText}>Copiar</Text>
              </TouchableOpacity>
            </View>
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
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  cardNome: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  cardModalidade: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primaryGlow,
  },
  cardTimes: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  cardRodadas: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  copyBtnText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.info,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  deleteBtnText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  modalScroll: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    letterSpacing: theme.letterSpacing.tight,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wider,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pickerItem: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
  },
  pickerItemSm: {
    width: 38,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
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
  pickerTextSm: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  pickerTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  cancelBtnText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: theme.fonts.body,
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
});
