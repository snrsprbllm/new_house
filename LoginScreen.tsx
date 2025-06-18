import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from './SupabaseClient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './App';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    try {
      setLoading(true);
      
      // Проверяем соединение
      console.log('Checking Supabase connection...');
      const { data: healthCheck, error: healthError } = await supabase.from('User').select('count').limit(1);
      
      console.log('Health check response:', { healthCheck, healthError });
      
      if (healthError) {
        console.error('Health check error details:', healthError);
        throw new Error('Ошибка соединения с сервером');
      }

      console.log('Attempting login with:', { email });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login response:', { data, error });

      if (error) {
        console.error('Auth error details:', error);
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Неверный email или пароль');
        }
        throw error;
      }

      if (!data.session || !data.session.user) {
        console.error('No session or user in response:', data);
        throw new Error('Не удалось создать сессию');
      }

      // Получаем профиль пользователя
      console.log('Searching for user with ID:', data.session.user.id);
      const { data: profile, error: profileError } = await supabase
        .from('User')
        .select('*')
        .eq('user_id', data.session.user.id)
        .single();

      console.log('Profile search result:', { profile, profileError });

      if (profileError) {
        console.error('Profile error details:', profileError);
        // If profile doesn't exist, create it
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, creating new profile');
          const { data: newProfile, error: createError } = await supabase
            .from('User')
            .insert([
              {
                user_id: data.session.user.id,
                email: data.session.user.email,
                fullname: '',
                age: null,
                gender: null,
                phone: null,
                avatarurl: null,
                building_id: null
              }
            ])
            .select()
            .single();

          if (createError || !newProfile) {
            console.error('Error creating profile:', createError);
            throw new Error('Не удалось создать профиль пользователя');
          }

          // Сохраняем данные пользователя
          await AsyncStorage.setItem('user', JSON.stringify(newProfile));
          navigation.replace('Home', { user: { email: newProfile.email } });
          return;
        }
        throw new Error('Ошибка получения профиля');
      }

      if (!profile) {
        console.error('No profile found for user:', data.session.user.id);
        throw new Error('Пользователь не найден');
      }

      // Сохраняем данные пользователя
      await AsyncStorage.setItem('user', JSON.stringify(profile));

      navigation.replace('Home', { user: { email: profile.email } });
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Ошибка', error.message || 'Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#ee8181', '#FFFFFF']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform && Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>Вход</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Вход...' : 'Войти'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}
            >
              <Text style={styles.registerText}>
                Нет аккаунта? Зарегистрироваться
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    padding: 20,
    width: width,
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 15,
    margin: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#ee8181',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#ee8181',
    fontSize: 16,
  },
});

export default LoginScreen;