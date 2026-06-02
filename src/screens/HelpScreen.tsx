import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

export default function HelpScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Foco e Perfil</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.inner}>
        <Card>
          <SectionHeader label="Foco" />
          <Text style={styles.body}>
            Controla o <Text style={styles.bold}>equilíbrio entre pontuação e valorização</Text> na escalação.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colValor]}>Valor</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colDesc]}>Comportamento</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colValor]}>1.0 (máx)</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Só pontuação. Ignora completamente valorização.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colValor]}>0.7</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Pontuação como prioridade, mas considera valorização levemente.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colValor]}>0.5</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Meio-termo. Valorização já tem peso relevante.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colValor]}>0.3</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Valorização vira prioridade. Abre mão de pontuação por atletas com potencial de alta.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colValor]}>0.0 (mín)</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Só valorização. Busca apenas atletas com maior potencial de ganho em cartoletas.</Text>
            </View>
          </View>

          <Text style={styles.subsectionTitle}>Na prática</Text>
          <Text style={styles.body}>
            • <Text style={styles.bold}>foco alto (0.8–1.0):</Text> para quem está brigando por pontos na rodada — quer o time com maior pontuação prevista, sem se importar com preço.{'\n'}
            • <Text style={styles.bold}>foco médio (0.5–0.7):</Text> equilíbrio — pontua bem mas sem descuidar do patrimônio. Ideal para ligas de pontuação onde valorização também importa.{'\n'}
            • <Text style={styles.bold}>foco baixo (0.0–0.4):</Text> modo "encher o bolso" — prioriza atletas com alto potencial de valorização. Útil para quem está longe do líder e quer acumular cartoletas para reagir depois.
          </Text>
        </Card>

        <Card>
          <SectionHeader label="Perfil" />
          <Text style={styles.body}>
            Define o <Text style={styles.bold}>nível de risco</Text> da escalação.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colPerfil]}>Perfil</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colDesc]}>Efeito</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colPerfil, { color: theme.colors.info }]}>Conservador</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Prefere atletas com muitos jogos e alta escalação (popularidade). Evita riscos.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colPerfil]}>Neutro</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Sem viés adicional. Apenas confiabilidade por frequência de jogos.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colPerfil, { color: theme.colors.danger }]}>Agressivo</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>Busca atletas com alto teto (grande potencial de pontuar acima da média). Dá desconto para atletas muito escalados (diferencial).</Text>
            </View>
          </View>

          <Text style={styles.subsectionTitle}>Na prática</Text>
          <Text style={styles.body}>
            • <Text style={styles.bold}>Conservador:</Text> você quer segurança. Escolhe jogadores que já provaram consistência, mesmo que o teto seja menor. Ideal para proteger liderança.{'\n'}
            • <Text style={styles.bold}>Neutro:</Text> sem preferência de risco. O otimizador apenas aplica um desconto para jogadores que jogam pouco.{'\n'}
            • <Text style={styles.bold}>Agressivo:</Text> você quer arriscar. Busca atletas com alto potencial de surpreender, mesmo que inconsistentes. Dá menos peso à popularidade. Ideal para buscar recuperação no ranking.
          </Text>
        </Card>

        <Card>
          <SectionHeader label="Combinando foco e perfil" />

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader, { flex: 1 }]}>Situação</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colSmall]}>Foco</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colSmall]}>Perfil</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Líder protegendo vantagem</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>1.0</Text>
              <Text style={[styles.tableCell, styles.colSmall, { color: theme.colors.info }]}>Conservador</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Brigando pelo título</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>1.0</Text>
              <Text style={[styles.tableCell, styles.colSmall, { color: theme.colors.danger }]}>Agressivo</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Longe do líder, muito turno</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>0.3</Text>
              <Text style={[styles.tableCell, styles.colSmall, { color: theme.colors.danger }]}>Agressivo</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Meio da tabela, sem pressa</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>0.7</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>Neutro</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Orçamento curto ({'<'} 85)</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>0.7</Text>
              <Text style={[styles.tableCell, styles.colSmall, { color: theme.colors.info }]}>Conservador</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Orçamento farto ({'>'} 130)</Text>
              <Text style={[styles.tableCell, styles.colSmall]}>1.0</Text>
              <Text style={[styles.tableCell, styles.colSmall, { color: theme.colors.danger }]}>Agressivo</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  inner: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'] + theme.spacing.sm,
  },
  subsectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  table: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  tableCell: {
    padding: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  tableHeader: {
    backgroundColor: theme.colors.surfaceElevated,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: theme.fontSize.xs,
    letterSpacing: 1,
  },
  colValor: {
    width: 70,
    fontWeight: theme.fontWeight.semibold,
  },
  colPerfil: {
    width: 90,
    fontWeight: theme.fontWeight.semibold,
  },
  colSmall: {
    width: 70,
    textAlign: 'center',
    fontWeight: theme.fontWeight.semibold,
  },
  colDesc: {
    flex: 1,
  },
});
