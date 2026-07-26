import { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text, StatusBar, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { theme } from './src/theme';
import { APP_VERSION } from './src/config';
import { checkForUpdate, getLastPromptedVersion } from './src/services/versionCheck';
import UpdateModal from './src/components/UpdateModal';
import StatusScreen from './src/screens/StatusScreen';
import StatusDetailScreen from './src/screens/StatusDetailScreen';
import LineupsScreen from './src/screens/LineupsScreen';
import NewLineupScreen from './src/screens/NewLineupScreen';
import LineupDetailScreen from './src/screens/LineupDetailScreen';
import JustificarScreen from './src/screens/JustificarScreen';
import AtletasScreen from './src/screens/AtletasScreen';
import LeaguesScreen from './src/screens/LeaguesScreen';
import LeagueDetailScreen from './src/screens/LeagueDetailScreen';
import HelpScreen from './src/screens/HelpScreen';

const Tab = createBottomTabNavigator();
const StatusStackNav = createNativeStackNavigator();
const Stack1 = createNativeStackNavigator();
const Stack2 = createNativeStackNavigator();

function StatusStack() {
  return (
    <StatusStackNav.Navigator screenOptions={{ headerShown: false }}>
      <StatusStackNav.Screen name="StatusMain" component={StatusScreen} />
      <StatusStackNav.Screen name="StatusDetail" component={StatusDetailScreen} />
    </StatusStackNav.Navigator>
  );
}

function LineupsStack() {
  return (
    <Stack1.Navigator screenOptions={{ headerShown: false }}>
      <Stack1.Screen name="LineupsList" component={LineupsScreen} />
      <Stack1.Screen name="NewLineup" component={NewLineupScreen} />
      <Stack1.Screen name="LineupDetail" component={LineupDetailScreen} />
      <Stack1.Screen name="Justificar" component={JustificarScreen} />
      <Stack1.Screen name="Help" component={HelpScreen} />
    </Stack1.Navigator>
  );
}

function LigasStack() {
  return (
    <Stack2.Navigator screenOptions={{ headerShown: false }}>
      <Stack2.Screen name="LeaguesList" component={LeaguesScreen} />
      <Stack2.Screen name="LeagueDetail" component={LeagueDetailScreen} />
    </Stack2.Navigator>
  );
}

if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Status: { active: '⚡', inactive: '⚡' },
  Escalações: { active: '📋', inactive: '📋' },
  Atletas: { active: '👤', inactive: '👤' },
  Ligas: { active: '🏆', inactive: '🏆' },
};

function TabIcon({ routeName, focused, color }: { routeName: string; focused: boolean; color: string }) {
  const icons = TAB_ICONS[routeName] || { active: '•', inactive: '•' };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {focused ? icons.active : icons.inactive}
    </Text>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'DM_Serif_Display_400Regular': DMSerifDisplay_400Regular,
    'DMSans_400Regular': DMSans_400Regular,
    'DMSans_500Medium': DMSans_500Medium,
    'DMSans_600SemiBold': DMSans_600SemiBold,
    'DMSans_700Bold': DMSans_700Bold,
  });

  const [splashDone, setSplashDone] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; current: string } | null>(null);

  useEffect(() => {
    if (fontsLoaded) {
      const t = setTimeout(() => setSplashDone(true), 200);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lastPrompted = await getLastPromptedVersion();
        const result = await checkForUpdate();
        if (cancelled) return;
        if (result.hasUpdate && result.latestVersion !== lastPrompted) {
          setUpdateInfo({ latest: result.latestVersion, current: result.currentVersion });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!splashDone) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.text, letterSpacing: -0.5 }}>
          EscalarML
        </Text>
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />

      <UpdateModal
        visible={updateInfo !== null}
        currentVersion={updateInfo?.current ?? APP_VERSION}
        latestVersion={updateInfo?.latest ?? ''}
        onClose={() => setUpdateInfo(null)}
      />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            paddingTop: 10,
            height: Platform.OS === 'ios' ? 90 : 68,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: {
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            letterSpacing: theme.letterSpacing.wide,
            marginTop: 4,
          },
        }}
      >
        <Tab.Screen
          name="Status"
          component={StatusStack}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <TabIcon routeName="Status" focused={focused} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Escalações"
          component={LineupsStack}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <TabIcon routeName="Escalações" focused={focused} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Atletas"
          component={AtletasScreen}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <TabIcon routeName="Atletas" focused={focused} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Ligas"
          component={LigasStack}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <TabIcon routeName="Ligas" focused={focused} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
