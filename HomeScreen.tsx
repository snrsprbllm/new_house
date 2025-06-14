import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NewsScreen from './NewsScreen';
import HousesScreen from './HousesScreen';
import CompaniesScreen from './CompaniesScreen';
import ProfileScreen from './ProfileScreen';
import EventsScreen from './EventsScreen';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, HomeScreenNavigationProp, HomeScreenRouteProp } from './App';
import { RouteProp } from '@react-navigation/native';
import { Platform } from 'react';


export type HomeTabsParamList = {
  News: undefined;
  Houses: undefined;
  Companies: undefined;
  Profile: undefined;
  Events: undefined;
};

type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
};

const Tab = createBottomTabNavigator<HomeTabsParamList>();


const GradientWrapper = ({ children }: { children: React.ReactNode }) => (
  <LinearGradient colors={['#ee8181', '#FFFFFF']} style={{ flex: 1 }}>
    {children}
  </LinearGradient>
);


const withGradient = <T extends keyof HomeTabsParamList>(
  Component: React.ComponentType<any>
) => {
  return (props: any) => (
    <GradientWrapper>
      <Component {...props} />
    </GradientWrapper>
  );
};


const GradientNewsScreen = withGradient<'News'>(NewsScreen);
const GradientHousesScreen = withGradient<'Houses'>(HousesScreen);
const GradientCompaniesScreen = withGradient<'Companies'>(CompaniesScreen);
const GradientProfileScreen = withGradient<'Profile'>(ProfileScreen);
const GradientEventsScreen = withGradient<'Events'>(EventsScreen);

const HomeScreen: React.FC<HomeScreenProps> = ({ route }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: { [key in keyof HomeTabsParamList]: string } = {
            News: focused ? 'newspaper' : 'newspaper-outline',
            Houses: focused ? 'home' : 'home-outline',
            Companies: focused ? 'business' : 'business-outline',
            Profile: focused ? 'person' : 'person-outline',
            Events: focused ? 'calendar' : 'calendar-outline',
          };

          const iconName = icons[route.name] || 'help-circle-outline';

          return <Ionicons 
            name={iconName as keyof typeof Ionicons.glyphMap} 
            size={size} 
            color={focused ? '#ee8181' : '#666'} 
          />;
        },
        headerShown: false,
        tabBarActiveTintColor: '#ee8181',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: Platform.OS === 'android' ? 70 : 85,
          paddingBottom: Platform.OS === 'android' ? 0 : 0,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 0,
          marginBottom: Platform.OS === 'android' ? 0 : 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: Platform.OS === 'android' ? 0 : 0,
        },
      })}
    >
      <Tab.Screen 
        name="News" 
        options={{ tabBarLabel: 'Новости' }}
      >
        {(props) => <GradientNewsScreen {...props} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Houses" 
        options={{ tabBarLabel: 'Дома' }}
      >
        {(props) => <GradientHousesScreen {...props} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Companies" 
        options={{ tabBarLabel: 'Компании' }}
      >
        {(props) => <GradientCompaniesScreen {...props} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Profile" 
        options={{ tabBarLabel: 'Профиль' }}
      >
        {(props) => <GradientProfileScreen {...props} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Events" 
        options={{ tabBarLabel: 'События' }}
      >
        {(props) => <GradientEventsScreen {...props} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default HomeScreen;
