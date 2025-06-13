import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseClient';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import HomeScreen from './HomeScreen';
import NewsScreen from './NewsScreen';
import HousesScreen from './HousesScreen';
import CompaniesScreen from './CompaniesScreen';
import ProfileScreen from './ProfileScreen';
import EventsScreen from './EventsScreen';
import { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: {
    user?: {
      email: string;
    };
  };
  News: undefined;
  Houses: undefined;
  Companies: undefined;
  Profile: undefined;
  Events: undefined;
};

export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');

  useEffect(() => {
    console.log('App: Starting initialization');
    const checkSession = async () => {
      try {
        console.log('App: Checking session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!session || sessionError) {
          console.log('App: No active session found', { sessionError });
          setInitialRoute('Login');
          return;
        }

        console.log('App: Session found, checking user data');
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          console.log('App: User data found in AsyncStorage');
          setInitialRoute('Home');
        } else {
          console.log('App: Fetching user data from Supabase');
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (user && !userError) {
            console.log('App: User found, fetching profile');
            const { data: profile, error: profileError } = await supabase
              .from('User')
              .select('*')
              .eq('userid', user.id)
              .single();

            if (profile && !profileError) {
              console.log('App: Profile found, saving to AsyncStorage');
              await AsyncStorage.setItem('user', JSON.stringify(profile));
              setInitialRoute('Home');
            } else {
              console.log('App: Profile error', { profileError });
              setInitialRoute('Login');
            }
          } else {
            console.log('App: User error', { userError });
            setInitialRoute('Login');
          }
        }
      } catch (error) {
        console.error('App: Error in checkSession:', error);
        setInitialRoute('Login');
      } finally {
        console.log('App: Initialization complete');
        setLoading(false);
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.log('App: Error hiding splash screen:', e);
        }
      }
    };

    checkSession();

    const authListener = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('App: Auth state changed', { event });
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('App: User signed in, fetching profile');
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('userid', session.user.id)
          .single();

        if (profile && !error) {
          console.log('App: Profile found, saving to AsyncStorage');
          await AsyncStorage.setItem('user', JSON.stringify(profile));
          setInitialRoute('Home');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('App: User signed out');
        await AsyncStorage.removeItem('user');
        setInitialRoute('Login');
      }
    });

    return () => {
      if (authListener) {
        console.log('App: Cleaning up auth listener');
        authListener.data.subscription.unsubscribe();
      }
    };
  }, []);

  if (loading) {
    console.log('App: Still loading');
    return null;
  }

  console.log('App: Rendering with initial route:', initialRoute);
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="News" component={NewsScreen} />
        <Stack.Screen name="Houses" component={HousesScreen} />
        <Stack.Screen name="Companies" component={CompaniesScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Events" component={EventsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;