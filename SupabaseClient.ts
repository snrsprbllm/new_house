import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://wcowzzqmgesbzwkfjlst.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjb3d6enFtZ2VzYnp3a2ZqbHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5OTM5MjgsImV4cCI6MjA1NjU2OTkyOH0.qzusb-tKMPKB8wqaX68LlHOWTRbE370hMpng1sPqWyE';

// Загружаем полифил для Android
try {
  require('react-native-get-random-values');
} catch (error) {
  console.log('react-native-get-random-values not available');
}

console.log('Initializing Supabase client...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Проверка инициализации
const checkSupabaseConnection = async () => {
  try {
    console.log('Checking Supabase connection...');
    const { data, error } = await supabase.from('User').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      throw error;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    return false;
  }
};

// Выполняем проверку при инициализации
checkSupabaseConnection().then(success => {
  if (!success) {
    console.error('Failed to initialize Supabase client');
  }
});