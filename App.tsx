import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import StatusScreen from './src/screens/StatusScreen';
import LineupsScreen from './src/screens/LineupsScreen';
import NewLineupScreen from './src/screens/NewLineupScreen';
import LineupDetailScreen from './src/screens/LineupDetailScreen';
import JustificarScreen from './src/screens/JustificarScreen';
import AtletasScreen from './src/screens/AtletasScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function LineupsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LineupsList" component={LineupsScreen} />
      <Stack.Screen name="NewLineup" component={NewLineupScreen} />
      <Stack.Screen name="LineupDetail" component={LineupDetailScreen} />
      <Stack.Screen name="Justificar" component={JustificarScreen} />
    </Stack.Navigator>
  );
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
