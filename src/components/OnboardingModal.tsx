import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import { getOnboardingDone, setOnboardingDone } from '../services/storage';

export interface OnboardingStep {
  icon: string;
  title: string;
  body: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: '📊',
    title: 'Escalações',
    body: 'Crie escalações otimizadas para o Cartola FC. Defina orçamento, formação, perfil de risco e foco — o algoritmo monta o melhor time possível.',
  },
  {
    icon: '🎯',
    title: 'Perfil e Foco',
    body: 'O Perfil define o nível de risco (Neutro, Agressivo, Conservador ou Upside). O Foco controla o equilíbrio entre pontuação e valorização dos atletas.',
  },
  {
    icon: '🏆',
    title: 'Ligas',
    body: 'Crie ligas com seus amigos, adicione times, gerencie bots e compare escalações. Acompanhe o ranking rodada a rodada.',
  },
  {
    icon: '👤',
    title: 'Atletas',
    body: 'Pesquise atletas por nome, posição ou status. Veja preço, média, upside e projeções. Toque em "i" nos detalhes da escalação para ver a justificativa completa.',
  },
];

export default function OnboardingModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const anim = useRef(new Animated.Value(1)).current;

  const animateOut = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      animateOut();
      setTimeout(() => {
        setStep(step + 1);
        Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      }, 220);
    } else {
      setOnboardingDone();
      onDone();
    }
  };

  const skip = () => {
    setOnboardingDone();
    onDone();
  };

  const s = STEPS[step];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
          <Text style={styles.icon}>{s.icon}</Text>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.skipBtn} onPress={skip}>
              <Text style={styles.skipBtnText}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>
                {step < STEPS.length - 1 ? 'Próximo →' : 'Começar!'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['2xl'],
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    maxWidth: 360,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['2xl'],
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontWeight: theme.fontWeight.bold,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.borderLight,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  skipBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  skipBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textMuted,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: theme.fonts.body,
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
});