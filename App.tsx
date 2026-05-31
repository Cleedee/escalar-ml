import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import StatusScreen from './src/screens/StatusScreen';
import LineupsScreen from './src/screens/LineupsScreen';
import NewLineupScreen from './src/screens/NewLineupScreen';
import LineupDetailScreen from './src/screens/LineupDetailScreen';
import JustificarScreen from './src/screens/JustificarScreen';
import AtletasScreen from './src/screens/AtletasScreen';
import LeaguesScreen from './src/screens/LeaguesScreen';
import LeagueDetailScreen from './src/screens/LeagueDetailScreen';
import HelpScreen from './src/screens/HelpScreen';

const Tab = createBottomTabNavigator();
const Stack1 = createNativeStackNavigator();
const Stack2 = createNativeStackNavigator();

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

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f172a',
            borderTopColor: '#1e293b',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: '#22c55e',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen
          name="Status"
          component={StatusScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 18, color }}>⚡</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Escalações"
          component={LineupsStack}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 18, color }}>📋</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Atletas"
          component={AtletasScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 18, color }}>👤</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Ligas"
          component={LigasStack}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 18, color }}>🏆</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
