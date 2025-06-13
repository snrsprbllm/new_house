import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Platform, Dimensions, StatusBar, Modal, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseClient';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

// Define screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Event {
  eventid: number;
  eventname: string;
  description: string;
  event_time: string;
  location: string;
  organizerid: number;
  latitude?: number;
  longitude?: number;
  duration?: number | string | null;
}

const EventsScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 55.7558,
    longitude: 37.6173
  });
  const [newEvent, setNewEvent] = useState({
    eventname: '',
    description: '',
    location: '',
    event_time: new Date(),
    duration: ''
  });
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchEvents();
    fetchCurrentUser();
    registerForPushNotifications();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .order('event_time', { ascending: true });
      
      if (error) throw error;
      
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.message?.includes('Network request failed')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от сервера. Проверьте подключение к интернету.';
      } else if (error.message?.includes('JWT expired')) {
        errorMessage = 'Сессия истекла. Пожалуйста, войдите снова.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Данные не найдены.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'Нет доступа к данным.';
      } else if (error.message?.includes('duplicate key')) {
        errorMessage = 'Запись с таким ключом уже существует.';
      } else if (error.message?.includes('invalid input')) {
        errorMessage = 'Неверные входные данные.';
      } else if (error.message?.includes('connection refused')) {
        errorMessage = 'Сервер недоступен. Попробуйте позже.';
      } else if (error.message?.includes('ECONNRESET')) {
        errorMessage = 'Соединение было сброшено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOTFOUND')) {
        errorMessage = 'Сервер не найден. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ETIMEDOUT')) {
        errorMessage = 'Превышено время ожидания ответа от сервера.';
      } else if (error.message?.includes('EACCES')) {
        errorMessage = 'Нет прав доступа.';
      } else if (error.message?.includes('EADDRINUSE')) {
        errorMessage = 'Сервер перегружен. Попробуйте позже.';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Соединение отклонено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('EHOSTUNREACH')) {
        errorMessage = 'Сервер недостижим. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENETUNREACH')) {
        errorMessage = 'Сеть недостижима. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENETDOWN')) {
        errorMessage = 'Сеть недоступна. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOBUFS')) {
        errorMessage = 'Недостаточно буферного пространства. Попробуйте позже.';
      } else if (error.message?.includes('ENOMEM')) {
        errorMessage = 'Недостаточно памяти. Попробуйте позже.';
      } else if (error.message?.includes('ENOSPC')) {
        errorMessage = 'Недостаточно места на диске.';
      } else if (error.message?.includes('EPIPE')) {
        errorMessage = 'Соединение разорвано. Проверьте подключение к интернету.';
      } else if (error.message?.includes('EPROTO')) {
        errorMessage = 'Ошибка протокола. Попробуйте позже.';
      } else if (error.message?.includes('EPROTONOSUPPORT')) {
        errorMessage = 'Неподдерживаемый протокол.';
      } else if (error.message?.includes('EPROTOTYPE')) {
        errorMessage = 'Неправильный тип протокола.';
      } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
        errorMessage = 'Неподдерживаемый тип сокета.';
      } else if (error.message?.includes('ESHUTDOWN')) {
        errorMessage = 'Соединение закрыто.';
      } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
        errorMessage = 'Неподдерживаемый тип сокета.';
      } else if (error.message?.includes('ETOOMANYREFS')) {
        errorMessage = 'Слишком много ссылок. Попробуйте позже.';
      } else if (error.message?.includes('EUSERS')) {
        errorMessage = 'Слишком много пользователей. Попробуйте позже.';
      } else if (error.message?.includes('EWOULDBLOCK')) {
        errorMessage = 'Операция заблокирована. Попробуйте позже.';
      } else if (error.message?.includes('EXDEV')) {
        errorMessage = 'Неправильное устройство.';
      } else if (error.message?.includes('ENOTCONN')) {
        errorMessage = 'Соединение не установлено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOTSOCK')) {
        errorMessage = 'Неправильный сокет.';
      } else if (error.message?.includes('ENOTTY')) {
        errorMessage = 'Неправильный тип устройства.';
      } else if (error.message?.includes('ENXIO')) {
        errorMessage = 'Нет такого устройства или адреса.';
      } else if (error.message?.includes('EOPNOTSUPP')) {
        errorMessage = 'Операция не поддерживается.';
      } else if (error.message?.includes('EOVERFLOW')) {
        errorMessage = 'Переполнение значения.';
      } else if (error.message?.includes('EPERM')) {
        errorMessage = 'Операция не разрешена.';
      } else if (error.message?.includes('EPROCLIM')) {
        errorMessage = 'Слишком много процессов.';
      } else if (error.message?.includes('ESTALE')) {
        errorMessage = 'Устаревший файловый дескриптор.';
      } else if (error.message?.includes('ETXTBSY')) {
        errorMessage = 'Текстовый файл занят.';
      } else if (error.message?.includes('EAGAIN')) {
        errorMessage = 'Ресурс временно недоступен. Попробуйте позже.';
      } else if (error.message?.includes('EBADF')) {
        errorMessage = 'Неправильный файловый дескриптор.';
      } else if (error.message?.includes('EBUSY')) {
        errorMessage = 'Устройство или ресурс занят.';
      } else if (error.message?.includes('ECHILD')) {
        errorMessage = 'Нет дочерних процессов.';
      } else if (error.message?.includes('EDEADLK')) {
        errorMessage = 'Обнаружена взаимоблокировка.';
      } else if (error.message?.includes('EDOM')) {
        errorMessage = 'Аргумент вне области определения.';
      } else if (error.message?.includes('EEXIST')) {
        errorMessage = 'Файл уже существует.';
      } else if (error.message?.includes('EFAULT')) {
        errorMessage = 'Неправильный адрес.';
      } else if (error.message?.includes('EFBIG')) {
        errorMessage = 'Файл слишком большой.';
      } else if (error.message?.includes('EINTR')) {
        errorMessage = 'Системный вызов прерван.';
      } else if (error.message?.includes('EINVAL')) {
        errorMessage = 'Неправильный аргумент.';
      } else if (error.message?.includes('EIO')) {
        errorMessage = 'Ошибка ввода-вывода.';
      } else if (error.message?.includes('EISDIR')) {
        errorMessage = 'Это директория.';
      } else if (error.message?.includes('EMFILE')) {
        errorMessage = 'Слишком много открытых файлов.';
      } else if (error.message?.includes('EMLINK')) {
        errorMessage = 'Слишком много ссылок.';
      } else if (error.message?.includes('ENAMETOOLONG')) {
        errorMessage = 'Имя файла слишком длинное.';
      } else if (error.message?.includes('ENFILE')) {
        errorMessage = 'Слишком много файлов в системе.';
      } else if (error.message?.includes('ENODEV')) {
        errorMessage = 'Нет такого устройства.';
      } else if (error.message?.includes('ENOENT')) {
        errorMessage = 'Нет такого файла или директории.';
      } else if (error.message?.includes('ENOEXEC')) {
        errorMessage = 'Ошибка выполнения.';
      } else if (error.message?.includes('ENOLCK')) {
        errorMessage = 'Нет доступных блокировок.';
      } else if (error.message?.includes('ENOMEM')) {
        errorMessage = 'Недостаточно памяти.';
      } else if (error.message?.includes('ENOSPC')) {
        errorMessage = 'Нет места на устройстве.';
      } else if (error.message?.includes('ENOSYS')) {
        errorMessage = 'Функция не реализована.';
      } else if (error.message?.includes('ENOTDIR')) {
        errorMessage = 'Это не директория.';
      } else if (error.message?.includes('ENOTEMPTY')) {
        errorMessage = 'Директория не пуста.';
      } else if (error.message?.includes('ENOTSUP')) {
        errorMessage = 'Операция не поддерживается.';
      } else if (error.message?.includes('ENXIO')) {
        errorMessage = 'Нет такого устройства или адреса.';
      } else if (error.message?.includes('EPERM')) {
        errorMessage = 'Операция не разрешена.';
      } else if (error.message?.includes('EPIPE')) {
        errorMessage = 'Разрыв канала.';
      } else if (error.message?.includes('ERANGE')) {
        errorMessage = 'Результат слишком большой.';
      } else if (error.message?.includes('EROFS')) {
        errorMessage = 'Файловая система только для чтения.';
      } else if (error.message?.includes('ESPIPE')) {
        errorMessage = 'Неправильный указатель.';
      } else if (error.message?.includes('ESRCH')) {
        errorMessage = 'Нет такого процесса.';
      } else if (error.message?.includes('ESTALE')) {
        errorMessage = 'Устаревший файловый дескриптор.';
      } else if (error.message?.includes('ETIMEDOUT')) {
        errorMessage = 'Превышено время ожидания.';
      } else if (error.message?.includes('ETXTBSY')) {
        errorMessage = 'Текстовый файл занят.';
      } else if (error.message?.includes('EXDEV')) {
        errorMessage = 'Неправильное устройство.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Ошибка',
        `Не удалось загрузить события: ${errorMessage}`,
        [
          {
            text: 'Повторить',
            onPress: () => fetchEvents()
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        setCurrentUser(user);
      }
    } catch (error: any) {
      console.error('Error fetching current user:', error);
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.message?.includes('Network request failed')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Ошибка',
        `Не удалось загрузить данные пользователя: ${errorMessage}`,
        [
          {
            text: 'Повторить',
            onPress: () => fetchCurrentUser()
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        Alert.alert('Требуется разрешение', 'Для получения уведомлений о новых событиях необходим доступ к уведомлениям');
        return;
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  const sendEventNotification = async (eventTitle: string) => {
    try {
      // Get all users except the current user
      const { data: users, error: usersError } = await supabase
        .from('User')
        .select('userid')
        .neq('userid', currentUser?.userid);

      if (usersError) throw usersError;

      // Create notifications for each user
      const notifications = users?.map(user => ({
        userid: user.userid,
        type: 'new_event',
        message: `Новое событие: ${eventTitle}`,
        notificationdate: new Date().toISOString(),
        status: 'unread'
      })) || [];

      if (notifications.length > 0) {
        const { error: notificationError } = await supabase
          .from('notification')
          .insert(notifications);

        if (notificationError) throw notificationError;
      }

      // Send push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Новое событие',
          body: eventTitle,
          data: { type: 'new_event' },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending event notification:', error);
    }
  };

  const addEvent = async () => {
    try {
      // Валидация ввода
      if (!newEvent.eventname.trim()) {
        Alert.alert('Ошибка', 'Пожалуйста, введите название события');
        return;
      }

      const userString = await AsyncStorage.getItem('user');
      if (!userString) {
        Alert.alert('Ошибка', 'Необходимо авторизоваться для добавления событий');
        return;
      }

      const user = JSON.parse(userString);
      if (!user.userid) {
        Alert.alert('Ошибка', 'Данные пользователя отсутствуют');
        return;
      }

      // Format the date/time to ISO 8601 with timezone
      const eventTime = newEvent.event_time;
      const formattedDateTime = eventTime.toISOString();

      const event = {
        eventname: newEvent.eventname.trim(),
        description: newEvent.description.trim(),
        event_time: formattedDateTime,
        location: newEvent.location.trim(),
        organizerid: parseInt(user.userid),
        latitude: selectedLocation?.latitude || null,
        longitude: selectedLocation?.longitude || null,
        duration: newEvent.duration ? parseInt(newEvent.duration as any, 10) : null
      };

      // Basic validation for duration
      if (event.duration !== null && (isNaN(event.duration) || event.duration <= 0)) {
          Alert.alert('Ошибка', 'Пожалуйста, введите корректную длительность события в часах (целое положительное число).');
          return;
      }

      const { data, error } = await supabase.from('event').insert([event]);
      
      if (error) throw error;
      
      await fetchEvents();
      
      setNewEvent({
        eventname: '',
        description: '',
        location: '',
        event_time: new Date(),
        duration: ''
      });
      setSelectedLocation({
        latitude: 55.7558,
        longitude: 37.6173
      });
      setShowAddForm(false);
      Alert.alert('Успех', 'Событие успешно добавлено!');

      // Send notification for the new event
      await sendEventNotification(event.eventname);
    } catch (error: any) {
      console.error('Error adding event:', error);
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.message?.includes('Network request failed')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от сервера. Проверьте подключение к интернету.';
      } else if (error.message?.includes('JWT expired')) {
        errorMessage = 'Сессия истекла. Пожалуйста, войдите снова.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Данные не найдены.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'Нет доступа к данным.';
      } else if (error.message?.includes('duplicate key')) {
        errorMessage = 'Запись с таким ключом уже существует.';
      } else if (error.message?.includes('invalid input')) {
        errorMessage = 'Неверные входные данные.';
      } else if (error.message?.includes('connection refused')) {
        errorMessage = 'Сервер недоступен. Попробуйте позже.';
      } else if (error.message?.includes('ECONNRESET')) {
        errorMessage = 'Соединение было сброшено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOTFOUND')) {
        errorMessage = 'Сервер не найден. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ETIMEDOUT')) {
        errorMessage = 'Превышено время ожидания ответа от сервера.';
      } else if (error.message?.includes('EACCES')) {
        errorMessage = 'Нет прав доступа.';
      } else if (error.message?.includes('EADDRINUSE')) {
        errorMessage = 'Сервер перегружен. Попробуйте позже.';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Соединение отклонено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('EHOSTUNREACH')) {
        errorMessage = 'Сервер недостижим. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENETUNREACH')) {
        errorMessage = 'Сеть недостижима. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENETDOWN')) {
        errorMessage = 'Сеть недоступна. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOBUFS')) {
        errorMessage = 'Недостаточно буферного пространства. Попробуйте позже.';
      } else if (error.message?.includes('ENOMEM')) {
        errorMessage = 'Недостаточно памяти. Попробуйте позже.';
      } else if (error.message?.includes('ENOSPC')) {
        errorMessage = 'Недостаточно места на диске.';
      } else if (error.message?.includes('EPIPE')) {
        errorMessage = 'Соединение разорвано. Проверьте подключение к интернету.';
      } else if (error.message?.includes('EPROTO')) {
        errorMessage = 'Ошибка протокола. Попробуйте позже.';
      } else if (error.message?.includes('EPROTONOSUPPORT')) {
        errorMessage = 'Неподдерживаемый протокол.';
      } else if (error.message?.includes('EPROTOTYPE')) {
        errorMessage = 'Неправильный тип протокола.';
      } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
        errorMessage = 'Неподдерживаемый тип сокета.';
      } else if (error.message?.includes('ESHUTDOWN')) {
        errorMessage = 'Соединение закрыто.';
      } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
        errorMessage = 'Неподдерживаемый тип сокета.';
      } else if (error.message?.includes('ETOOMANYREFS')) {
        errorMessage = 'Слишком много ссылок. Попробуйте позже.';
      } else if (error.message?.includes('EUSERS')) {
        errorMessage = 'Слишком много пользователей. Попробуйте позже.';
      } else if (error.message?.includes('EWOULDBLOCK')) {
        errorMessage = 'Операция заблокирована. Попробуйте позже.';
      } else if (error.message?.includes('EXDEV')) {
        errorMessage = 'Неправильное устройство.';
      } else if (error.message?.includes('ENOTCONN')) {
        errorMessage = 'Соединение не установлено. Проверьте подключение к интернету.';
      } else if (error.message?.includes('ENOTSOCK')) {
        errorMessage = 'Неправильный сокет.';
      } else if (error.message?.includes('ENOTTY')) {
        errorMessage = 'Неправильный тип устройства.';
      } else if (error.message?.includes('ENXIO')) {
        errorMessage = 'Нет такого устройства или адреса.';
      } else if (error.message?.includes('EOPNOTSUPP')) {
        errorMessage = 'Операция не поддерживается.';
      } else if (error.message?.includes('EOVERFLOW')) {
        errorMessage = 'Переполнение значения.';
      } else if (error.message?.includes('EPERM')) {
        errorMessage = 'Операция не разрешена.';
      } else if (error.message?.includes('EPROCLIM')) {
        errorMessage = 'Слишком много процессов.';
      } else if (error.message?.includes('ESTALE')) {
        errorMessage = 'Устаревший файловый дескриптор.';
      } else if (error.message?.includes('ETXTBSY')) {
        errorMessage = 'Текстовый файл занят.';
      } else if (error.message?.includes('EAGAIN')) {
        errorMessage = 'Ресурс временно недоступен. Попробуйте позже.';
      } else if (error.message?.includes('EBADF')) {
        errorMessage = 'Неправильный файловый дескриптор.';
      } else if (error.message?.includes('EBUSY')) {
        errorMessage = 'Устройство или ресурс занят.';
      } else if (error.message?.includes('ECHILD')) {
        errorMessage = 'Нет дочерних процессов.';
      } else if (error.message?.includes('EDEADLK')) {
        errorMessage = 'Обнаружена взаимоблокировка.';
      } else if (error.message?.includes('EDOM')) {
        errorMessage = 'Аргумент вне области определения.';
      } else if (error.message?.includes('EEXIST')) {
        errorMessage = 'Файл уже существует.';
      } else if (error.message?.includes('EFAULT')) {
        errorMessage = 'Неправильный адрес.';
      } else if (error.message?.includes('EFBIG')) {
        errorMessage = 'Файл слишком большой.';
      } else if (error.message?.includes('EINTR')) {
        errorMessage = 'Системный вызов прерван.';
      } else if (error.message?.includes('EINVAL')) {
        errorMessage = 'Неправильный аргумент.';
      } else if (error.message?.includes('EIO')) {
        errorMessage = 'Ошибка ввода-вывода.';
      } else if (error.message?.includes('EISDIR')) {
        errorMessage = 'Это директория.';
      } else if (error.message?.includes('EMFILE')) {
        errorMessage = 'Слишком много открытых файлов.';
      } else if (error.message?.includes('EMLINK')) {
        errorMessage = 'Слишком много ссылок.';
      } else if (error.message?.includes('ENAMETOOLONG')) {
        errorMessage = 'Имя файла слишком длинное.';
      } else if (error.message?.includes('ENFILE')) {
        errorMessage = 'Слишком много файлов в системе.';
      } else if (error.message?.includes('ENODEV')) {
        errorMessage = 'Нет такого устройства.';
      } else if (error.message?.includes('ENOENT')) {
        errorMessage = 'Нет такого файла или директории.';
      } else if (error.message?.includes('ENOEXEC')) {
        errorMessage = 'Ошибка выполнения.';
      } else if (error.message?.includes('ENOLCK')) {
        errorMessage = 'Нет доступных блокировок.';
      } else if (error.message?.includes('ENOMEM')) {
        errorMessage = 'Недостаточно памяти.';
      } else if (error.message?.includes('ENOSPC')) {
        errorMessage = 'Нет места на устройстве.';
      } else if (error.message?.includes('ENOSYS')) {
        errorMessage = 'Функция не реализована.';
      } else if (error.message?.includes('ENOTDIR')) {
        errorMessage = 'Это не директория.';
      } else if (error.message?.includes('ENOTEMPTY')) {
        errorMessage = 'Директория не пуста.';
      } else if (error.message?.includes('ENOTSUP')) {
        errorMessage = 'Операция не поддерживается.';
      } else if (error.message?.includes('ENXIO')) {
        errorMessage = 'Нет такого устройства или адреса.';
      } else if (error.message?.includes('EPERM')) {
        errorMessage = 'Операция не разрешена.';
      } else if (error.message?.includes('EPIPE')) {
        errorMessage = 'Разрыв канала.';
      } else if (error.message?.includes('ERANGE')) {
        errorMessage = 'Результат слишком большой.';
      } else if (error.message?.includes('EROFS')) {
        errorMessage = 'Файловая система только для чтения.';
      } else if (error.message?.includes('ESPIPE')) {
        errorMessage = 'Неправильный указатель.';
      } else if (error.message?.includes('ESRCH')) {
        errorMessage = 'Нет такого процесса.';
      } else if (error.message?.includes('ESTALE')) {
        errorMessage = 'Устаревший файловый дескриптор.';
      } else if (error.message?.includes('ETIMEDOUT')) {
        errorMessage = 'Превышено время ожидания.';
      } else if (error.message?.includes('ETXTBSY')) {
        errorMessage = 'Текстовый файл занят.';
      } else if (error.message?.includes('EXDEV')) {
        errorMessage = 'Неправильное устройство.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Ошибка',
        `Не удалось добавить событие: ${errorMessage}`,
        [
          {
            text: 'Повторить',
            onPress: () => addEvent()
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewEvent({ ...newEvent, event_time: selectedDate });
    }
  };

  const handleLocationSelect = (event: any) => {
    if (!event.nativeEvent.coordinate) return;
    
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert('Ошибка', 'Не удалось определить координаты. Попробуйте еще раз.');
      return;
    }
    
    setSelectedLocation({ latitude, longitude });
    setNewEvent({ 
      ...newEvent, 
      location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` 
    });
  };

  const handleDislike = async (eventId: number, currentStatus: string | null) => {
    // ... existing code ...
  };

  const deleteEvent = async (eventId: number) => {
    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to delete events.');
      return;
    }

    Alert.alert(
      'Удаление события',
      'Вы уверены, что хотите удалить это событие?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('event')
                .delete()
                .eq('eventid', eventId);

              if (error) throw error;

              await fetchEvents();
            } catch (error: any) {
              console.error('Error deleting event:', error);
              let errorMessage = 'Неизвестная ошибка';
              
              if (error.message?.includes('Network request failed')) {
                errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
              } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
                errorMessage = 'Превышено время ожидания ответа от сервера. Проверьте подключение к интернету.';
              } else if (error.message?.includes('JWT expired')) {
                errorMessage = 'Сессия истекла. Пожалуйста, войдите снова.';
              } else if (error.message?.includes('not found')) {
                errorMessage = 'Данные не найдены.';
              } else if (error.message?.includes('permission denied')) {
                errorMessage = 'Нет доступа к данным.';
              } else if (error.message?.includes('duplicate key')) {
                errorMessage = 'Запись с таким ключом уже существует.';
              } else if (error.message?.includes('invalid input')) {
                errorMessage = 'Неверные входные данные.';
              } else if (error.message?.includes('connection refused')) {
                errorMessage = 'Сервер недоступен. Попробуйте позже.';
              } else if (error.message?.includes('ECONNRESET')) {
                errorMessage = 'Соединение было сброшено. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ENOTFOUND')) {
                errorMessage = 'Сервер не найден. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ETIMEDOUT')) {
                errorMessage = 'Превышено время ожидания ответа от сервера.';
              } else if (error.message?.includes('EACCES')) {
                errorMessage = 'Нет прав доступа.';
              } else if (error.message?.includes('EADDRINUSE')) {
                errorMessage = 'Сервер перегружен. Попробуйте позже.';
              } else if (error.message?.includes('ECONNREFUSED')) {
                errorMessage = 'Соединение отклонено. Проверьте подключение к интернету.';
              } else if (error.message?.includes('EHOSTUNREACH')) {
                errorMessage = 'Сервер недостижим. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ENETUNREACH')) {
                errorMessage = 'Сеть недостижима. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ENETDOWN')) {
                errorMessage = 'Сеть недоступна. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ENOBUFS')) {
                errorMessage = 'Недостаточно буферного пространства. Попробуйте позже.';
              } else if (error.message?.includes('ENOMEM')) {
                errorMessage = 'Недостаточно памяти. Попробуйте позже.';
              } else if (error.message?.includes('ENOSPC')) {
                errorMessage = 'Недостаточно места на диске.';
              } else if (error.message?.includes('EPIPE')) {
                errorMessage = 'Соединение разорвано. Проверьте подключение к интернету.';
              } else if (error.message?.includes('EPROTO')) {
                errorMessage = 'Ошибка протокола. Попробуйте позже.';
              } else if (error.message?.includes('EPROTONOSUPPORT')) {
                errorMessage = 'Неподдерживаемый протокол.';
              } else if (error.message?.includes('EPROTOTYPE')) {
                errorMessage = 'Неправильный тип протокола.';
              } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
                errorMessage = 'Неподдерживаемый тип сокета.';
              } else if (error.message?.includes('ESHUTDOWN')) {
                errorMessage = 'Соединение закрыто.';
              } else if (error.message?.includes('ESOCKTNOSUPPORT')) {
                errorMessage = 'Неподдерживаемый тип сокета.';
              } else if (error.message?.includes('ETOOMANYREFS')) {
                errorMessage = 'Слишком много ссылок. Попробуйте позже.';
              } else if (error.message?.includes('EUSERS')) {
                errorMessage = 'Слишком много пользователей. Попробуйте позже.';
              } else if (error.message?.includes('EWOULDBLOCK')) {
                errorMessage = 'Операция заблокирована. Попробуйте позже.';
              } else if (error.message?.includes('EXDEV')) {
                errorMessage = 'Неправильное устройство.';
              } else if (error.message?.includes('ENOTCONN')) {
                errorMessage = 'Соединение не установлено. Проверьте подключение к интернету.';
              } else if (error.message?.includes('ENOTSOCK')) {
                errorMessage = 'Неправильный сокет.';
              } else if (error.message?.includes('ENOTTY')) {
                errorMessage = 'Неправильный тип устройства.';
              } else if (error.message?.includes('ENXIO')) {
                errorMessage = 'Нет такого устройства или адреса.';
              } else if (error.message?.includes('EOPNOTSUPP')) {
                errorMessage = 'Операция не поддерживается.';
              } else if (error.message?.includes('EOVERFLOW')) {
                errorMessage = 'Переполнение значения.';
              } else if (error.message?.includes('EPERM')) {
                errorMessage = 'Операция не разрешена.';
              } else if (error.message?.includes('EPROCLIM')) {
                errorMessage = 'Слишком много процессов.';
              } else if (error.message?.includes('ESTALE')) {
                errorMessage = 'Устаревший файловый дескриптор.';
              } else if (error.message?.includes('ETXTBSY')) {
                errorMessage = 'Текстовый файл занят.';
              } else if (error.message?.includes('EAGAIN')) {
                errorMessage = 'Ресурс временно недоступен. Попробуйте позже.';
              } else if (error.message?.includes('EBADF')) {
                errorMessage = 'Неправильный файловый дескриптор.';
              } else if (error.message?.includes('EBUSY')) {
                errorMessage = 'Устройство или ресурс занят.';
              } else if (error.message?.includes('ECHILD')) {
                errorMessage = 'Нет дочерних процессов.';
              } else if (error.message?.includes('EDEADLK')) {
                errorMessage = 'Обнаружена взаимоблокировка.';
              } else if (error.message?.includes('EDOM')) {
                errorMessage = 'Аргумент вне области определения.';
              } else if (error.message?.includes('EEXIST')) {
                errorMessage = 'Файл уже существует.';
              } else if (error.message?.includes('EFAULT')) {
                errorMessage = 'Неправильный адрес.';
              } else if (error.message?.includes('EFBIG')) {
                errorMessage = 'Файл слишком большой.';
              } else if (error.message?.includes('EINTR')) {
                errorMessage = 'Системный вызов прерван.';
              } else if (error.message?.includes('EINVAL')) {
                errorMessage = 'Неправильный аргумент.';
              } else if (error.message?.includes('EIO')) {
                errorMessage = 'Ошибка ввода-вывода.';
              } else if (error.message?.includes('EISDIR')) {
                errorMessage = 'Это директория.';
              } else if (error.message?.includes('EMFILE')) {
                errorMessage = 'Слишком много открытых файлов.';
              } else if (error.message?.includes('EMLINK')) {
                errorMessage = 'Слишком много ссылок.';
              } else if (error.message?.includes('ENAMETOOLONG')) {
                errorMessage = 'Имя файла слишком длинное.';
              } else if (error.message?.includes('ENFILE')) {
                errorMessage = 'Слишком много файлов в системе.';
              } else if (error.message?.includes('ENODEV')) {
                errorMessage = 'Нет такого устройства.';
              } else if (error.message?.includes('ENOENT')) {
                errorMessage = 'Нет такого файла или директории.';
              } else if (error.message?.includes('ENOEXEC')) {
                errorMessage = 'Ошибка выполнения.';
              } else if (error.message?.includes('ENOLCK')) {
                errorMessage = 'Нет доступных блокировок.';
              } else if (error.message?.includes('ENOMEM')) {
                errorMessage = 'Недостаточно памяти.';
              } else if (error.message?.includes('ENOSPC')) {
                errorMessage = 'Нет места на устройстве.';
              } else if (error.message?.includes('ENOSYS')) {
                errorMessage = 'Функция не реализована.';
              } else if (error.message?.includes('ENOTDIR')) {
                errorMessage = 'Это не директория.';
              } else if (error.message?.includes('ENOTEMPTY')) {
                errorMessage = 'Директория не пуста.';
              } else if (error.message?.includes('ENOTSUP')) {
                errorMessage = 'Операция не поддерживается.';
              } else if (error.message?.includes('ENXIO')) {
                errorMessage = 'Нет такого устройства или адреса.';
              } else if (error.message?.includes('EPERM')) {
                errorMessage = 'Операция не разрешена.';
              } else if (error.message?.includes('EPIPE')) {
                errorMessage = 'Разрыв канала.';
              } else if (error.message?.includes('ERANGE')) {
                errorMessage = 'Результат слишком большой.';
              } else if (error.message?.includes('EROFS')) {
                errorMessage = 'Файловая система только для чтения.';
              } else if (error.message?.includes('ESPIPE')) {
                errorMessage = 'Неправильный указатель.';
              } else if (error.message?.includes('ESRCH')) {
                errorMessage = 'Нет такого процесса.';
              } else if (error.message?.includes('ESTALE')) {
                errorMessage = 'Устаревший файловый дескриптор.';
              } else if (error.message?.includes('ETIMEDOUT')) {
                errorMessage = 'Превышено время ожидания.';
              } else if (error.message?.includes('ETXTBSY')) {
                errorMessage = 'Текстовый файл занят.';
              } else if (error.message?.includes('EXDEV')) {
                errorMessage = 'Неправильное устройство.';
              } else if (error.message) {
                errorMessage = error.message;
              }
              
              Alert.alert(
                'Ошибка',
                `Не удалось удалить событие: ${errorMessage}`,
                [
                  {
                    text: 'Повторить',
                    onPress: () => deleteEvent(eventId)
                  },
                  {
                    text: 'OK',
                    style: 'cancel'
                  }
                ]
              );
            }
          },
        },
      ],
    );
  };

  function openSystemMap({ latitude, longitude, label }: { latitude: number, longitude: number, label?: string }) {
    const latLng = `${latitude},${longitude}`;
    const query = label ? `${latitude},${longitude}(${encodeURIComponent(label)})` : latLng;
    let url = '';
    if (Platform.OS === 'ios') {
      url = `http://maps.apple.com/?ll=${latLng}&q=${encodeURIComponent(label || '')}`;
    } else {
      url = `geo:${latLng}?q=${query}`;
    }
    Linking.openURL(url);
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>События</Text>
      {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Ionicons name={showAddForm ? "close-circle" : "add-circle"} size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAddForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView contentContainerStyle={styles.formScrollView}>
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Название события"
            value={newEvent.eventname}
            onChangeText={(text) => setNewEvent({ ...newEvent, eventname: text })}
            textAlign="center"
          />
          <TextInput
            style={styles.input}
            placeholder="Описание"
            value={newEvent.description}
            onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
            textAlign="center"
          />
          <TextInput
            style={styles.input}
            placeholder="Длительность (часы)"
            value={newEvent.duration}
            onChangeText={(text) => setNewEvent({ ...newEvent, duration: text as any })}
            keyboardType="numeric"
            textAlign="center"
          />
          <TouchableOpacity 
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickerText}>Дата: {newEvent.event_time.toLocaleDateString()}</Text>
            <Ionicons name="calendar" size={24} color="#666" />
          </TouchableOpacity>

          {!showLocationPicker && (
            <TouchableOpacity 
              style={styles.locationPickerButton}
              onPress={() => setShowLocationPicker(true)}
            >
              <Text style={styles.locationPickerText}>
                {newEvent.location || "Выберите место на карте"}
              </Text>
              <Ionicons name="location" size={24} color="#666" />
            </TouchableOpacity>
          )}

          {showLocationPicker && (
            <View style={styles.mapContainerForSelection}>
              <WebView
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                        <script src="https://api-maps.yandex.ru/2.1/?apikey=f3f88826-ab92-499b-bdc5-0382ee4759b0&lang=ru_RU" type="text/javascript"></script>
                        <style>
                          html, body, #map {
                            width: 100%;
                            height: 100%;
                            margin: 0;
                            padding: 0;
                          }
                        </style>
                      </head>
                      <body>
                        <div id="map"></div>
                        <script>
                          ymaps.ready(function() {
                            const map = new ymaps.Map('map', {
                              center: [${selectedLocation.latitude}, ${selectedLocation.longitude}],
                              zoom: 12,
                              controls: ['zoomControl', 'fullscreenControl']
                            });

                            ${selectedLocation.latitude !== 55.7558 || selectedLocation.longitude !== 37.6173 ? `
                              const placemark = new ymaps.Placemark([${selectedLocation.latitude}, ${selectedLocation.longitude}], {
                                balloonContent: 'Выбранное место'
                              }, {
                                preset: 'islands#redDotIcon'
                              });
                              map.geoObjects.add(placemark);
                            ` : ''}

                            map.events.add('click', function(e) {
                              const coords = e.get('coords');
                              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                type: 'location', 
                                lat: coords[0], 
                                lng: coords[1] 
                              }));
                            });
                          });
                        </script>
                      </body>
                    </html>
                  `
                }}
                style={styles.mapInsideForm}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                scrollEnabled={false}
                bounces={false}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'location') {
                      setSelectedLocation({ latitude: data.lat, longitude: data.lng });
                      setNewEvent({ 
                        ...newEvent, 
                        location: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` 
                      });
                    }
                  } catch (error) {
                    console.error('Error parsing message from WebView:', error);
                  }
                }}
              />
              <TouchableOpacity 
                style={styles.confirmLocationButton}
                onPress={() => setShowLocationPicker(false)}
              >
                <Text style={styles.confirmLocationText}>Подтвердить место</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showLocationPicker && (
            <TouchableOpacity style={styles.submitButton} onPress={addEvent}>
              <Text style={styles.submitButtonText}>Добавить событие</Text>
            </TouchableOpacity>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={newEvent.event_time}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderEventItem = useCallback(({ item }: { item: Event }) => {
    let durationText = 'Не указана';
    let eventStatus = '';

    let durationInHours: number | null = null;

    if (item.duration !== null && item.duration !== undefined) {
      if (typeof item.duration === 'number') {
        durationInHours = item.duration;
        durationText = `${durationInHours} ч.`;
      } else if (typeof item.duration === 'string') {
        const parts = item.duration.split(':');
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          const parsedHours = parseInt(lastPart, 10);
          if (!isNaN(parsedHours)) {
            durationInHours = parsedHours;
            durationText = `${durationInHours} ч.`;
          } else {
            durationText = 'Неизвестно';
          }
        } else {
          durationText = 'Неизвестно';
        }
      }
    }

    if (durationInHours !== null && item.event_time) {
      const now = new Date();
      const eventStartTime = new Date(item.event_time);
      const eventEndTime = new Date(eventStartTime);
      const durationNum = typeof durationInHours === 'number' ? durationInHours : 0;
      eventEndTime.setHours(eventEndTime.getHours() + durationNum);
      const eventEndTimeWithBuffer = new Date(eventEndTime.getTime() + 60 * 1000);
      const nowUTC = new Date(now.toISOString());
      const startUTC = new Date(eventStartTime.toISOString());
      const endUTC = new Date(eventEndTimeWithBuffer.toISOString());

      if (nowUTC >= startUTC && nowUTC <= endUTC) {
        eventStatus = 'Событие идет';
      } else if (nowUTC > endUTC) {
        eventStatus = 'Событие завершено';
      } else if (nowUTC < startUTC) {
        eventStatus = 'Предстоящее событие';
      }
    }

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={styles.eventHeaderTop}>
            <Text style={styles.eventTitle}>{item.eventname}</Text>
            {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => deleteEvent(item.eventid)}
              >
                <Ionicons name="trash-outline" size={24} color="#ee8181" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.eventDetails}>Дата: {new Date(item.event_time).toLocaleDateString()}</Text> 
          <Text style={styles.eventDetails}>Время: {new Date(item.event_time).toLocaleTimeString()}</Text> 
          
          {item.duration !== null && item.duration !== undefined && (
             <Text style={styles.eventDetails}>Длительность: {durationText}</Text>
          )}

          {eventStatus ? (
             <Text style={[styles.eventDetails, eventStatus === 'Событие идет' ? styles.eventStatusActive : null]}>
                {eventStatus}
             </Text>
          ) : null}

          <Text style={styles.eventDetails}>Место: {item.location}</Text>
          {item.latitude && item.longitude && (
            <TouchableOpacity 
              style={styles.mapButton} 
              onPress={() => {
                setViewMode('map');
                setSelectedLocation({ latitude: item.latitude!, longitude: item.longitude! });
              }}
            >
              <Text style={styles.mapButtonText}>Показать на карте</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.eventDescription}>{item.description}</Text>
      </View>
    );
  }, [currentUser]);

  const renderMap = () => {
    const markers = events
      .filter(event => event.latitude && event.longitude)
      .map(event => ({
        lat: event.latitude,
        lng: event.longitude,
        title: event.eventname,
        description: event.description,
        time: new Date(event.event_time).toLocaleString(),
        location: event.location
      }));

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <script src="https://api-maps.yandex.ru/2.1/?apikey=f3f88826-ab92-499b-bdc5-0382ee4759b0&lang=ru_RU" type="text/javascript"></script>
          <style>
            html, body, #map {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
            .custom-popup {
              font-family: Arial, sans-serif;
              padding: 10px;
              max-width: 300px;
            }
            .custom-popup h3 {
              margin: 0 0 10px 0;
              color: #ee8181;
              font-size: 16px;
            }
            .custom-popup p {
              margin: 5px 0;
              font-size: 14px;
              color: #333;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            ymaps.ready(function() {
              const map = new ymaps.Map('map', {
                center: [${selectedLocation.latitude}, ${selectedLocation.longitude}],
                zoom: 12,
                controls: ['zoomControl', 'fullscreenControl']
              });

              const markers = ${JSON.stringify(markers)};
              
              markers.forEach(marker => {
                const popupContent = 
                  '<div class="custom-popup">' +
                    '<h3>' + marker.title + '</h3>' +
                    '<p><strong>Время:</strong> ' + marker.time + '</p>' +
                    '<p><strong>Место:</strong> ' + marker.location + '</p>' +
                    '<p><strong>Описание:</strong> ' + marker.description + '</p>' +
                  '</div>';
                
                const placemark = new ymaps.Placemark([marker.lat, marker.lng], {
                  balloonContent: popupContent
                }, {
                  preset: 'islands#redDotIcon'
                });

                map.geoObjects.add(placemark);
              });

              map.events.add('click', function(e) {
                const coords = e.get('coords');
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'location', 
                  lat: coords[0], 
                  lng: coords[1] 
                }));
              });
            });
          </script>
        </body>
      </html>
    `;

    return (
      <View style={styles.mapContainer}>
        <WebView
          source={{ html }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          scrollEnabled={true}
          bounces={true}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'location') {
                setSelectedLocation({ latitude: data.lat, longitude: data.lng });
                setNewEvent({ 
                  ...newEvent, 
                  location: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}` 
                });
              }
            } catch (error) {
              console.error('Error parsing message from WebView:', error);
            }
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ee8181" barStyle="light-content" />
      <LinearGradient colors={['#ee8181', '#FFFFFF']} style={styles.gradient}>
        {renderHeader()}
        
        {!showAddForm && (
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.activeToggle]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list" size={24} color={viewMode === 'list' ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'map' && styles.activeToggle]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map" size={24} color={viewMode === 'map' ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
        )}
        
        {showAddForm ? (
          renderAddForm()
        ) : (
          viewMode === 'list' ? (
            <FlatList
              data={events}
              keyExtractor={(item) => item.eventid.toString()}
              renderItem={renderEventItem}
              style={styles.list}
            />
          ) : (
            renderMap()
          )
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  addButton: {
    padding: 5,
  },
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
  },
  toggleButton: {
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeToggle: {
    backgroundColor: '#ee8181',
    borderColor: '#ee8181',
  },
  formContainer: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    margin: 10,
    borderRadius: 10,
  },
  input: {
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#ee8181',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
  },
  eventHeader: {
    marginBottom: 10,
  },
  eventHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  eventTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#ee8181',
    marginBottom: 5,
  },
  eventDetails: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 3,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 10,
    margin: 10,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    color: '#ee8181',
    textAlign: 'center',
    marginBottom: 10,
  },
  closeButton: {
    padding: 5,
  },
  confirmLocationButton: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: '#ee8181',
    padding: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  confirmLocationText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  datePickerText: {
    color: '#333',
    textAlign: 'center',
    flex: 1,
    marginRight: 10,
  },
  locationPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  locationPickerText: {
    color: '#333',
    textAlign: 'center',
    flex: 1,
    marginRight: 10,
  },
  mapButton: {
    padding: 5,
    backgroundColor: '#ee8181',
    borderRadius: 5,
    marginTop: 5,
  },
  mapButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  emptyList: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
  },
  placeholderText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  mapContainerForSelection: {
    height: SCREEN_HEIGHT * 0.5,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  mapInsideForm: {
    width: '100%',
    height: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  formScrollView: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  eventStatusActive: {
    color: 'green',
    fontWeight: 'bold',
  },
});

export default EventsScreen; 