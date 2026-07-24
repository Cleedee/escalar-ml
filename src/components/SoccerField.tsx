import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Rect,
  Line,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { Player, Tecnico, Reserva } from '../types';
import { theme } from '../theme';

interface Props {
  players: Player[];
  formacao: string;
  tecnico: Tecnico;
  reservas: Record<string, Reserva>;
}

const POS_LABEL: Record<string, string> = {
  GOL: 'GOL',
  LAT: 'LAT',
  ZAG: 'ZAG',
  MEI: 'MEI',
  ATA: 'ATA',
};

const POS_ORDER: Record<string, number> = {
  GOL: 0,
  ZAG: 1,
  LAT: 2,
  MEI: 3,
  ATA: 4,
};

function getXPositions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [50];
  if (count === 2) return [30, 70];
  if (count === 3) return [18, 50, 82];
  if (count === 4) return [14, 38, 62, 86];
  if (count === 5) return [10, 30, 50, 70, 90];
  return Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * 100);
}

export default function SoccerField({ players, formacao, tecnico, reservas }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const fieldWidth = Math.min(screenWidth - 32, 400);
  const fieldHeight = fieldWidth * 1.45;

  const parts = formacao.split('-').map(Number);
  const defCount = parts[0] ?? 4;
  const meiCount = parts[1] ?? 3;
  const ataCount = parts[2] ?? 3;

  const gol = players.filter((p) => p.posicao === 'GOL');
  const def = players
    .filter((p) => p.posicao === 'LAT' || p.posicao === 'ZAG')
    .sort((a, b) => (POS_ORDER[a.posicao] ?? 0) - (POS_ORDER[b.posicao] ?? 0));
  const mei = players.filter((p) => p.posicao === 'MEI');
  const ata = players.filter((p) => p.posicao === 'ATA');

  const rows = [
    { players: ata, y: 20 },
    { players: mei, y: 54 },
    { players: def, y: 90 },
    { players: gol, y: 123 },
  ];

  const vbW = 100;
  const vbH = 145;
  const fieldGreen = '#1a6b3c';
  const lineColor = 'rgba(255,255,255,0.55)';

  return (
    <View style={styles.container}>
      <View style={styles.fieldWrapper}>
        <Svg
          width={fieldWidth}
          height={fieldHeight}
          viewBox={`0 0 ${vbW} ${vbH}`}
        >
          <Rect x="0" y="0" width={vbW} height={vbH} fill={fieldGreen} />
          <Rect
            x="3"
            y="3"
            width={vbW - 6}
            height={vbH - 6}
            stroke={lineColor}
            strokeWidth="0.8"
            fill="none"
          />
          <Line
            x1="3"
            y1={vbH / 2}
            x2={vbW - 3}
            y2={vbH / 2}
            stroke={lineColor}
            strokeWidth="0.8"
          />
          <Circle
            cx={vbW / 2}
            cy={vbH / 2}
            r="9"
            stroke={lineColor}
            strokeWidth="0.6"
            fill="none"
          />
          <Circle cx={vbW / 2} cy={vbH / 2} r="1.2" fill={lineColor} />

          <Rect x="18" y="4" width="64" height="16" stroke={lineColor} strokeWidth="0.6" fill="none" />
          <Rect x="28" y="6" width="44" height="8" stroke={lineColor} strokeWidth="0.6" fill="none" />
          <Circle cx={vbW / 2} cy="21" r="1" fill={lineColor} />
          <Circle cx={vbW / 2} cy="24" r="6" stroke={lineColor} strokeWidth="0.5" fill="none" />

          <Rect x="18" y={vbH - 20} width="64" height="16" stroke={lineColor} strokeWidth="0.6" fill="none" />
          <Rect x="28" y={vbH - 14} width="44" height="8" stroke={lineColor} strokeWidth="0.6" fill="none" />
          <Circle cx={vbW / 2} cy={vbH - 21} r="1" fill={lineColor} />
          <Circle cx={vbW / 2} cy={vbH - 24} r="6" stroke={lineColor} strokeWidth="0.5" fill="none" />

          <Rect x="40" y="0" width="20" height="3.5" fill="rgba(255,255,255,0.8)" />
          <Rect x="40" y={vbH - 3.5} width="20" height="3.5" fill="rgba(255,255,255,0.8)" />

          {rows.map((row) => {
            const xs = getXPositions(row.players.length);
            return row.players.map((p, i) => {
              const x = xs[i];
              const y = row.y;
              const isCap = p.role === 'capitao';
              const name =
                p.apelido.length > 11
                  ? p.apelido.slice(0, 10) + '…'
                  : p.apelido;
              return (
                <G key={p.atleta_id}>
                  <Circle
                    cx={x}
                    cy={y}
                    r="6.5"
                    fill={theme.colors.surfaceElevated}
                    stroke={isCap ? theme.colors.accent : theme.colors.primary}
                    strokeWidth="1.3"
                  />
                  <SvgText
                    x={x}
                    y={y + 1.5}
                    textAnchor="middle"
                    fontSize="6"
                    fontWeight="bold"
                    fill={theme.colors.text}
                  >
                    {POS_LABEL[p.posicao] || p.posicao}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={y + 11}
                    textAnchor="middle"
                    fontSize="5.2"
                    fill={theme.colors.text}
                    fontWeight="600"
                  >
                    {name}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={y + 15.5}
                    textAnchor="middle"
                    fontSize="4.5"
                    fill={theme.colors.textSecondary}
                  >
                    C${p.preco.toFixed(1)}
                  </SvgText>
                  {isCap && (
                    <SvgText
                      x={x + 8}
                      y={y - 7}
                      textAnchor="middle"
                      fontSize="7"
                      fill={theme.colors.accent}
                    >
                      {'★'}
                    </SvgText>
                  )}
                </G>
              );
            });
          })}
        </Svg>

        <View style={styles.formationBadge}>
          <Text style={styles.formationBadgeText}>{formacao}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { borderColor: theme.colors.primary }]} />
          <Text style={styles.legendText}>Titular</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { borderColor: theme.colors.accent }]} />
          <Text style={styles.legendText}>Capitão (pts ×1.5)</Text>
        </View>
      </View>

      {Object.keys(reservas).length > 0 && (
        <View style={styles.bench}>
          <Text style={styles.benchTitle}>
            Banco ({Object.keys(reservas).length})
          </Text>
          <View style={styles.benchRow}>
            {Object.entries(reservas).map(([pos, r]) => (
              <View key={pos} style={styles.benchPlayer}>
                <View
                  style={[
                    styles.benchDot,
                    r.luxo && styles.benchDotLuxo,
                  ]}
                >
                  <Text style={styles.benchDotText}>
                    {POS_LABEL[pos] || pos}
                  </Text>
                </View>
                <Text style={styles.benchName} numberOfLines={1}>
                  {r.apelido}
                </Text>
                <Text style={styles.benchPrice}>
                  C${r.preco.toFixed(1)}
                </Text>
                {r.luxo && (
                  <Text style={styles.benchLuxo}>reserva luxo</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {tecnico && tecnico.apelido && (
        <View style={styles.coachRow}>
          <Text style={styles.coachLabel}>Técnico</Text>
          <Text style={styles.coachName}>
            {tecnico.apelido} · {tecnico.clube}
          </Text>
          <Text style={styles.coachPrice}>
            C${tecnico.preco.toFixed(1)} · {tecnico.previsto.toFixed(1)} pts
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  fieldWrapper: {
    position: 'relative',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadow.lg,
  },
  formationBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  formationBadgeText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: theme.colors.surfaceElevated,
  },
  legendText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  bench: {
    width: '100%',
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  benchTitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  benchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  benchPlayer: {
    alignItems: 'center',
    width: 70,
  },
  benchDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  benchDotLuxo: {
    borderColor: theme.colors.accent,
  },
  benchDotText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary,
  },
  benchName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },
  benchPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  benchLuxo: {
    fontSize: 9,
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
  },
  coachLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  coachName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    flex: 1,
  },
  coachPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
});
