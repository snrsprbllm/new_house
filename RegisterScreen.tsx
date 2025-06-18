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

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (!email.includes('@')) {
      setError('Пожалуйста, введите корректный email');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Attempting to sign up with:', { email });
      
      // First, try to register the user in Supabase auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log('Sign up response:', { data, error });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('Этот email уже зарегистрирован');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Не удалось создать пользователя');
      }

      // Create user record in User table with the auth user ID
      const { error: insertError } = await supabase
        .from('User')
        .insert([
          {
            user_id: data.user.id, // Use the auth user ID
            email: email as string,
            fullname: '',
            age: null,
            gender: null,
            phone: null,
            avatarurl: null,
            building_id: null
          }
        ]);

      if (insertError) {
        console.error('Error creating user record:', insertError);
        throw new Error('Не удалось создать запись пользователя');
      }

      // Get the created profile to save to AsyncStorage
      const { data: profile, error: profileError } = await supabase
        .from('User')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching created profile:', profileError);
        throw new Error('Не удалось получить профиль пользователя');
      }

      // Save user data to AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(profile));

      navigation.replace('Home', { user: { email: data.user.email || email } });
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Произошла неизвестная ошибка при регистрации');
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
            <Text style={styles.title}>Регистрация</Text>
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
            
            <TextInput
              style={styles.input}
              placeholder="Подтвердите пароль"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
            >
              <Text style={styles.loginText}>
                Уже есть аккаунт? Войти
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#ee8181',
    fontSize: 16,
  },
});

export default RegisterScreen;