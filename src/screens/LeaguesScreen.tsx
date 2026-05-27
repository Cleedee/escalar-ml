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
import { League } from '../types';
import { deleteLeague, getLeagues, saveLeague } from '../services/storage';
import { fetchStatus } from '../services/api';

const RODADAS = Array.from({ length: 38 }, (_, i) => i + 1);

export default function LeaguesScreen({ navigation }: any) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [showForm, setShowForm] = useState(false);
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
            style={styles.card}
            onPress={() => navigation.navigate('LeagueDetail', { league: item })}
          >
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
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Text style={styles.deleteBtnText}>Excluir</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openForm}>
        <Text style={styles.addBtnText}>+ Nova Liga</Text>
      </TouchableOpacity>

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
              placeholderTextColor="#64748b"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardModalidade: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  cardTimes: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cardRodadas: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  addBtn: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalScroll: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
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
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  pickerItemSm: {
    width: 38,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  pickerActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  pickerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pickerTextSm: {
    fontSize: 13,
    color: '#94a3b8',
  },
  pickerTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
