import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './SupabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

interface ProfileScreenProps {
  navigation: any;
}

interface Building {
  buildingid: number;
  address: string;
}

// Define screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const profileSchema = Yup.object().shape({
  fullName: Yup.string().required('Обязательное поле'),
  age: Yup.number().min(18, 'Минимальный возраст 18 лет').max(100, 'Некорректный возраст').required('Обязательное поле'),
  phone: Yup.string()
    .matches(/^\+?[0-9]{10,15}$/, 'Некорректный номер телефона')
    .required('Обязательное поле'),
  gender: Yup.string().required('Обязательное поле'),
});

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [buildingAddress, setBuildingAddress] = useState<string>('');
  const [initialValues, setInitialValues] = useState({
    fullName: '',
    age: '',
    phone: '',
    gender: '',
  });

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      await AsyncStorage.removeItem('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Ошибка', 'Произошла ошибка при выходе из системы.');
    }
  };

  const pickImage = async () => {
    try {
      const user = JSON.parse(await AsyncStorage.getItem('user') || '{}');
      
      // Prevent admin from changing avatar
      if (user.user_id === 'admin') {
        Alert.alert('Информация', 'Аватар администратора не может быть изменен');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${user.user_id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Convert image to base64
        const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('kp02bucket')
          .upload(filePath, decode(base64), {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('kp02bucket')
          .getPublicUrl(filePath);

        setAvatar(publicUrl);
      }
    } catch (error) {
      console.error('Error picking/uploading image:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить изображение');
    }
  };

  const saveProfile = async (values: { fullName: string; age: string; phone: string; gender: string }) => {
    try {
      const user = JSON.parse(await AsyncStorage.getItem('user') || '{}');

      if (!user.user_id) {
        throw new Error('Данные пользователя отсутствуют');
      }

      // Handle admin user
      if (user.user_id === 'admin') {
        Alert.alert('Успешно', 'Профиль администратора не может быть изменен');
        return;
      }

      const age = parseInt(values.age, 10);

      const { error } = await supabase.from('User').update({
        fullname: values.fullName,
        age: age,
        gender: values.gender,
        phone: values.phone,
        avatarurl: avatar,
      }).eq('user_id', user.user_id);

      if (error) {
        console.error('Ошибка Supabase:', error);
        throw new Error(error.message);
      }

      Alert.alert('Успешно', 'Профиль успешно обновлен');
    } catch (error) {
      Alert.alert('Ошибка', (error as Error).message);
    }
  };

  const fetchBuildingAddress = async (buildingId: number) => {
    try {
      const { data, error } = await supabase
        .from('residentialbuilding')
        .select('address')
        .eq('buildingid', buildingId)
        .single();

      if (error) throw error;

      if (data?.address) {
        setBuildingAddress(data.address);
      }
    } catch (error) {
      console.error('Error fetching building address:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userString = await AsyncStorage.getItem('user');
        console.log('User data from AsyncStorage:', userString);
        
        if (!userString) {
          console.warn('No user data found in AsyncStorage');
          Alert.alert('Ошибка', 'Данные пользователя не найдены. Пожалуйста, войдите снова.');
          navigation.replace('Login');
          return;
        }

        const user = JSON.parse(userString);
        console.log('Parsed user data:', user);

        if (!user.user_id) {
          console.error('Invalid user data:', user);
          Alert.alert('Ошибка', 'Неверные данные пользователя. Пожалуйста, войдите снова.');
          navigation.replace('Login');
          return;
        }

        // Handle admin user
        if (user.user_id === 'admin') {
          setInitialValues({
            fullName: 'Администратор',
            age: '',
            phone: '',
            gender: '',
          });
          setUserEmail(user.email);
          return;
        }

        // Получаем данные пользователя из Supabase
        const { data, error } = await supabase
          .from('User')
          .select('fullname, age, gender, phone, avatarurl, building_id')
          .eq('user_id', user.user_id)
          .single();

        if (error) {
          console.error('Supabase error:', error);
          throw new Error(error.message);
        }

        if (!data) {
          console.error('No user data found in Supabase');
          throw new Error('Данные пользователя не найдены в базе данных');
        }

        setInitialValues({
          fullName: data.fullname || '',
          age: data.age ? data.age.toString() : '',
          phone: data.phone || '',
          gender: data.gender || '',
        });

        if (data.avatarurl) {
          // If the avatar URL is a Supabase storage URL, get a signed URL
          if (data.avatarurl.includes('supabase.co/storage/v1/object/public')) {
            const match = data.avatarurl.match(/public\/([^\/]+)\/(.+)/);
            if (match) {
              const bucket = match[1];
              const filePath = match[2];
              const { data: signedUrlData } = await supabase.storage
                .from(bucket)
                .createSignedUrl(filePath, 3600);
              if (signedUrlData?.signedUrl) {
                setAvatar(signedUrlData.signedUrl);
              }
            }
          } else {
            setAvatar(data.avatarurl);
          }
        }

        if (user.email) {
          setUserEmail(user.email);
        }

        // Получаем адрес здания, если есть building_id
        if (data.building_id) {
          await fetchBuildingAddress(data.building_id);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить данные профиля. Пожалуйста, попробуйте позже.');
      }
    };

    fetchUserData();
  }, []);

  return (
    <LinearGradient colors={['#ee8181', '#FFFFFF']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Профиль</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            {avatar ? (
              <Image 
                source={{ uri: avatar }} 
                style={styles.avatar}
                onError={(error) => {
                  console.error('Error loading avatar:', error.nativeEvent);
                  setAvatar(null);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#ee8181" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.formContainer}>
            <Formik
              initialValues={initialValues}
              validationSchema={profileSchema}
              onSubmit={(values) => saveProfile(values)}
              enableReinitialize
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email:</Text>
                    <Text style={styles.emailText}>{userEmail}</Text>
                  </View>

                  {buildingAddress && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Адрес:</Text>
                      <Text style={styles.emailText}>{buildingAddress}</Text>
                    </View>
                  )}

                  <TextInput
                    style={styles.input}
                    placeholder="ФИО"
                    value={values.fullName}
                    onChangeText={handleChange('fullName')}
                    onBlur={handleBlur('fullName')}
                  />
                  {touched.fullName && errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}

                  <TextInput
                    style={styles.input}
                    placeholder="Возраст"
                    value={values.age}
                    onChangeText={handleChange('age')}
                    onBlur={handleBlur('age')}
                    keyboardType="numeric"
                  />
                  {touched.age && errors.age && <Text style={styles.error}>{errors.age}</Text>}

                  <Text style={styles.label}>Пол:</Text>
                  <View style={styles.genderContainer}>
                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        values.gender === 'Мужской' && styles.selectedGenderButton
                      ]}
                      onPress={() => handleChange('gender')('Мужской')}
                    >
                      <Text style={[
                        styles.genderButtonText,
                        values.gender === 'Мужской' && styles.selectedGenderButtonText
                      ]}>Мужской</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        values.gender === 'Женский' && styles.selectedGenderButton
                      ]}
                      onPress={() => handleChange('gender')('Женский')}
                    >
                      <Text style={[
                        styles.genderButtonText,
                        values.gender === 'Женский' && styles.selectedGenderButtonText
                      ]}>Женский</Text>
                    </TouchableOpacity>
                  </View>
                  {touched.gender && errors.gender && <Text style={styles.error}>{errors.gender}</Text>}

                  <TextInput
                    style={styles.input}
                    placeholder="Телефон"
                    value={values.phone}
                    onChangeText={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                  />
                  {touched.phone && errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

                  <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                    <Text style={styles.buttonText}>Сохранить профиль</Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: SCREEN_HEIGHT * 0.15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 45,
    height: Platform.OS === 'ios' ? 90 : 85,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  avatarContainer: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: SCREEN_WIDTH * 0.2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: SCREEN_WIDTH * 0.2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  formContainer: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: SCREEN_WIDTH * 0.05,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  emailText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 10,
    fontSize: SCREEN_WIDTH * 0.04,
    marginBottom: 15,
  },
  error: {
    color: 'red',
    fontSize: SCREEN_WIDTH * 0.035,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#ee8181',
    borderRadius: 10,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: SCREEN_WIDTH * 0.04,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.1,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#ee8181',
    fontWeight: 'bold',
    fontSize: SCREEN_WIDTH * 0.04,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  selectedGenderButton: {
    backgroundColor: '#ee8181',
    borderColor: '#ee8181',
  },
  genderButtonText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
  },
  selectedGenderButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ProfileScreen;