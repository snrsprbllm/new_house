import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseClient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './App';
import { useNavigation } from '@react-navigation/native';

interface News {
  newsid: number;
  title: string;
  content: string;
  publishdate: string;
  imageurl?: string;
  authorid: number;
  likes: number;
  dislikes: number;
  userLikeStatus: 'like' | 'dislike' | null;
  eventid?: number;
  User?: {
    fullname: string;
    role?: string;
    avatarurl?: string;
    building_id?: number;
  };
}

interface Category {
  categoryid: number;
  categoryname: string;
}

interface User {
  userid: number;
  fullname: string;
  role?: string;
}

interface Comment {
  commentid: number;
  newsid: number;
  userid: number;
  commenttext: string;
  commentdate: string;
  user: {
    fullname: string;
    role?: string;
    avatarurl?: string;
    building_id?: number;
  };
}

interface Building {
  buildingid: number;
  address: string;
}

interface Event {
  eventid: number;
  title: string;
  description: string;
  event_time: string;
  location: string;
  eventname: string;
}

// Define screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NewsScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'News'>;
}

const NewsScreen: React.FC<NewsScreenProps> = ({ navigation }) => {
  const navigationNative = useNavigation();
  const [news, setNews] = useState<News[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<{[key: number]: boolean}>({});
  const [newsImages, setNewsImages] = useState<{ [key: number]: string[] }>({});
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'mostLiked'>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [processingLike, setProcessingLike] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({
    window: Dimensions.get('window')
  });
  const [comments, setComments] = useState<{[key: number]: Comment[]}>({});
  const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const commentInputRef = React.useRef<TextInput>(null);
  const [commentText, setCommentText] = useState('');
  const [userAvatars, setUserAvatars] = useState<{[key: number]: string}>({});
  const [buildings, setBuildings] = useState<{[key: number]: string}>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentButtonDisabled, setCommentButtonDisabled] = useState(false);

  // Add listener for screen dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ window });
    });
    
    return () => subscription.remove();
  }, []);

  const fetchNews = useCallback(async (sort: 'newest' | 'oldest' | 'mostLiked', user: User | null) => {
    try {
      setLoading(true);
      let query = supabase
        .from('news')
        .select(`
          *,
          User:authorid (
            fullname,
            role,
            avatarurl,
            building_id
          ),
          likedislike:likedislike(
            type,
            userid
          )
        `);

      if (sort === 'newest') {
        query = query.order('publishdate', { ascending: false });
      } else if (sort === 'oldest') {
        query = query.order('publishdate', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        let newsWithCounts = data.map((news: any) => {
          const likedislikeArr: any[] = Array.isArray(news.likedislike) ? news.likedislike : [];
          const likes = likedislikeArr.filter((l: any) => l.type === 'like').length;
          const dislikes = likedislikeArr.filter((l: any) => l.type === 'dislike').length;
          let userLikeStatus: 'like' | 'dislike' | null = null;
          if (user) {
            const userLike = likedislikeArr.find((l: any) => l.userid === user.userid);
            if (userLike) userLikeStatus = userLike.type;
          }
          return { ...news, likes, dislikes, userLikeStatus };
        });

        // Получаем signedUrl для картинок с повторными попытками
        const newsWithImages = await Promise.all(
          newsWithCounts.map(async (news) => {
            if (news.imageurl) {
              try {
                let filePath = news.imageurl;
                // Если путь содержит полный URL, извлекаем только путь к файлу
                if (filePath.includes('supabase.co/storage/v1/object/public')) {
                  const match = filePath.match(/public\/([^\/]+)\/(.+)/);
                  if (match) {
                    filePath = match[2];
                  }
                }
                // Если путь содержит имя бакета, удаляем его
                if (filePath.includes('kp02bucket/')) {
                  filePath = filePath.split('kp02bucket/')[1];
                }
                
                console.log('Getting signed URL for:', filePath);
                
                // Функция для получения signed URL с повторными попытками
                const getSignedUrlWithRetry = async (retries = 3, delay = 1000) => {
                  for (let i = 0; i < retries; i++) {
                    try {
                      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                        .from('kp02bucket')
                        .createSignedUrl(filePath, 3600);
                      
                      if (signedUrlError) {
                        console.error(`Attempt ${i + 1} failed:`, signedUrlError);
                        if (i === retries - 1) throw signedUrlError;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                      }
                      
                      if (signedUrlData?.signedUrl) {
                        console.log('Got signed URL:', signedUrlData.signedUrl);
                        return signedUrlData.signedUrl;
                      }
                    } catch (error) {
                      console.error(`Attempt ${i + 1} failed with error:`, error);
                      if (i === retries - 1) throw error;
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
                  }
                  throw new Error('Failed to get signed URL after all retries');
                };

                const signedUrl = await getSignedUrlWithRetry();
                return { ...news, imageurl: signedUrl };
              } catch (error) {
                console.error('Error processing image URL:', error);
                // Возвращаем оригинальный URL в случае ошибки
                return news;
              }
            }
            return news;
          })
        );

        if (sort === 'mostLiked') {
          newsWithImages.sort((a: any, b: any) => b.likes - a.likes);
        }
        setNews(newsWithImages);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить новости');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .order('event_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
    }
  }, []);

  useEffect(() => {
    fetchNews(sortOption, currentUser);
    fetchCategories();
    fetchCurrentUser();
    fetchEvents();
    requestMediaLibraryPermissions();
    // Add call to delete expired events
    const deleteExpiredEvents = async () => {
      try {
        await supabase.rpc('delete_expired_events');
      } catch (error) {
        console.error('Error deleting expired events:', error);
      }
    };
    deleteExpiredEvents();
  }, [fetchNews, fetchEvents]);

  const requestMediaLibraryPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Требуется разрешение', 'Для загрузки изображений необходим доступ к галерее');
      }
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchNewsImages = async (newsId: number) => {
    try {
      const { data, error } = await supabase
        .from('newsimage')
        .select('*')
        .eq('newsid', newsId);

      if (error) throw error;

      if (data && data.length > 0) {
        console.log('Raw news images data:', data);
        const imageUrls = await Promise.all(
          data.map(async (image) => {
            if (image.imageurl) {
              console.log('Processing news image URL:', image.imageurl);
              // Handle both full paths and just filenames
              let filePath = image.imageurl;
              if (filePath.includes('kp02bucket/')) {
                filePath = filePath.split('kp02bucket/')[1];
              }
              console.log('Using file path:', filePath);
              
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('kp02bucket')
                .createSignedUrl(filePath, 3600);
              
              console.log('Signed URL response:', signedUrlData, 'Error:', signedUrlError);
              
              if (signedUrlData?.signedUrl) {
                console.log('Using signed URL:', signedUrlData.signedUrl);
                return signedUrlData.signedUrl;
              }
            }
            return null;
          })
        );
        const validUrls = imageUrls.filter((url): url is string => url !== null);
        console.log('Processed image URLs:', validUrls);
        setNewsImages((prev) => ({ ...prev, [newsId]: validUrls }));
      }
    } catch (error) {
      console.error('Error fetching news images:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('category').select('*');

      if (error) {
        throw new Error(error.message);
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const handleAddNews = () => {
    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to add news.');
      return;
    }
    setAddModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);
      console.log('Starting image upload, uri:', uri);

      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `news/${fileName}`;

      console.log('Upload details:', { fileExt, fileName, filePath });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('File converted to base64');

      // Функция для загрузки с повторными попытками
      const uploadWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const { data, error: uploadError } = await supabase.storage
              .from('kp02bucket')
              .upload(filePath, decode(base64), {
                contentType: `image/${fileExt}`,
                upsert: true
              });

            if (uploadError) {
              console.error(`Upload attempt ${i + 1} failed:`, uploadError);
              if (i === retries - 1) throw uploadError;
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            console.log('Upload successful, data:', data);
            
            // Проверяем, что файл действительно загружен
            const { data: checkData, error: checkError } = await supabase.storage
              .from('kp02bucket')
              .download(filePath);
              
            if (checkError) {
              console.error(`File verification attempt ${i + 1} failed:`, checkError);
              if (i === retries - 1) throw new Error('File upload verification failed');
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            
            console.log('File verification successful');
            return filePath;
          } catch (error) {
            console.error(`Upload attempt ${i + 1} failed with error:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        throw new Error('Failed to upload file after all retries');
      };

      return await uploadWithRetry();
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const submitNews = async () => {
    if (!title.trim() || !content.trim() || !selectedCategory) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to add news');
      return;
    }

    setUploading(true);

    try {
      let imageUrl = null;
      if (selectedImage) {
        try {
          imageUrl = await uploadImage(selectedImage);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert(
            'Ошибка загрузки изображения',
            'Не удалось загрузить изображение. Попробуйте еще раз или продолжите без изображения.',
            [
              {
                text: 'Продолжить без изображения',
                onPress: () => submitNewsWithoutImage(),
                style: 'default'
              },
              {
                text: 'Отмена',
                onPress: () => setUploading(false),
                style: 'cancel'
              }
            ]
          );
          return;
        }
      }

      await submitNewsWithImage(imageUrl);
    } catch (error) {
      console.error('Error adding news:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
      setUploading(false);
    }
  };

  const submitNewsWithImage = async (imageUrl: string | null) => {
    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to add news');
      return;
    }

    try {
      const { data, error } = await supabase.from('news').insert([
        {
          title: title.trim(),
          content: content.trim(),
          authorid: currentUser.userid,
          categoryid: selectedCategory,
          imageurl: imageUrl,
          eventid: selectedEvent,
          publishdate: new Date().toISOString(),
        },
      ]).select();

      if (error) {
        throw new Error(error.message);
      }

      setAddModalVisible(false);
      setTitle('');
      setContent('');
      setSelectedImage(null);
      setSelectedCategory(null);
      setSelectedEvent(null);
      await fetchNews(sortOption, currentUser);
      Alert.alert('Успех', 'Новость успешно добавлена!');
    } catch (error) {
      console.error('Error adding news:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const submitNewsWithoutImage = async () => {
    await submitNewsWithImage(null);
  };

  const handleLike = async (newsId: number, currentStatus: 'like' | 'dislike' | null) => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Необходимо войти в систему для оценки новостей.');
      return;
    }
    if (processingLike !== null) {
      return;
    }
    try {
      setProcessingLike(newsId);
      setNews(prevNews =>
        prevNews.map(item => {
          if (item.newsid === newsId) {
            let newLikes = item.likes;
            let newDislikes = item.dislikes;
            let newStatus: 'like' | 'dislike' | null = item.userLikeStatus;
            switch (currentStatus) {
              case 'like':
                newLikes--;
                newStatus = null;
                break;
              case 'dislike':
                newDislikes--;
                newLikes++;
                newStatus = 'like';
                break;
              default:
                newLikes++;
                newStatus = 'like';
            }
            return { ...item, likes: newLikes, dislikes: newDislikes, userLikeStatus: newStatus };
          }
          return item;
        })
      );
      switch (currentStatus) {
        case 'like': {
          const { error: deleteError } = await supabase
            .from('likedislike')
            .delete()
            .eq('newsid', newsId)
            .eq('userid', currentUser.userid);
          if (deleteError) {
            console.error('Error removing like:', deleteError);
            Alert.alert('Ошибка', 'Не удалось удалить оценку. Попробуйте позже.');
            return;
          }
          return;
        }
        case 'dislike': {
          const { error: deleteError } = await supabase
            .from('likedislike')
            .delete()
            .eq('newsid', newsId)
            .eq('userid', currentUser.userid);
          if (deleteError) {
            console.error('Error removing like:', deleteError);
            Alert.alert('Ошибка', 'Не удалось удалить оценку. Попробуйте позже.');
            return;
          }
          // break intentionally omitted to allow insert
        }
        default: {
          const { error: insertError } = await supabase.from('likedislike').insert([
            {
              newsid: newsId,
              userid: currentUser.userid,
              type: 'like',
            },
          ]);
          if (insertError) {
            console.error('Error adding like:', insertError);
            Alert.alert('Ошибка', 'Не удалось поставить лайк. Попробуйте позже.');
            return;
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in handleLike:', error);
      Alert.alert('Ошибка', 'Произошла непредвиденная ошибка при оценке новости.');
    } finally {
      setProcessingLike(null);
    }
  };

  const handleDislike = async (newsId: number, currentStatus: 'like' | 'dislike' | null) => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Необходимо войти в систему для оценки новостей.');
      return;
    }
    if (processingLike !== null) {
      return;
    }
    try {
      setProcessingLike(newsId);
      setNews(prevNews =>
        prevNews.map(item => {
          if (item.newsid === newsId) {
            let newLikes = item.likes;
            let newDislikes = item.dislikes;
            let newStatus: 'like' | 'dislike' | null = item.userLikeStatus;
            switch (currentStatus) {
              case 'dislike':
                newDislikes--;
                newStatus = null;
                break;
              case 'like':
                newLikes--;
                newDislikes++;
                newStatus = 'dislike';
                break;
              default:
                newDislikes++;
                newStatus = 'dislike';
            }
            return { ...item, likes: newLikes, dislikes: newDislikes, userLikeStatus: newStatus };
          }
          return item;
        })
      );
      switch (currentStatus) {
        case 'dislike': {
          const { error: deleteError } = await supabase
            .from('likedislike')
            .delete()
            .eq('newsid', newsId)
            .eq('userid', currentUser.userid);
          if (deleteError) {
            console.error('Error removing dislike:', deleteError);
            Alert.alert('Ошибка', 'Не удалось удалить оценку. Попробуйте позже.');
            return;
          }
          return;
        }
        case 'like': {
          const { error: deleteError } = await supabase
            .from('likedislike')
            .delete()
            .eq('newsid', newsId)
            .eq('userid', currentUser.userid);
          if (deleteError) {
            console.error('Error removing dislike:', deleteError);
            Alert.alert('Ошибка', 'Не удалось удалить оценку. Попробуйте позже.');
            return;
          }
          // break intentionally omitted to allow insert
        }
        default: {
          const { error: insertError } = await supabase.from('likedislike').insert([
            {
              newsid: newsId,
              userid: currentUser.userid,
              type: 'dislike',
            },
          ]);
          if (insertError) {
            console.error('Error adding dislike:', insertError);
            Alert.alert('Ошибка', 'Не удалось поставить дизлайк. Попробуйте позже.');
            return;
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in handleDislike:', error);
      Alert.alert('Ошибка', 'Произошла непредвиденная ошибка при оценке новости.');
    } finally {
      setProcessingLike(null);
    }
  };

  const deleteNews = async (newsId: number) => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Необходимо войти в систему для удаления новостей.');
      return;
    }

    Alert.alert(
      'Удаление новости',
      'Вы уверены, что хотите удалить эту новость?',
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
              // Сначала удаляем связанные комментарии
              const { error: commentError } = await supabase
                .from('comment')
                .delete()
                .eq('newsid', newsId);

              if (commentError) {
                console.error('Error deleting comments:', commentError);
                Alert.alert('Ошибка', 'Не удалось удалить комментарии. Попробуйте позже.');
                return;
              }

              // Затем удаляем связанные лайки/дизлайки
              const { error: likeError } = await supabase
                .from('likedislike')
                .delete()
                .eq('newsid', newsId);

              if (likeError) {
                console.error('Error deleting likes:', likeError);
                Alert.alert('Ошибка', 'Не удалось удалить оценки. Попробуйте позже.');
                return;
              }

              // И наконец удаляем новость
              const { error: newsError } = await supabase
                .from('news')
                .delete()
                .eq('newsid', newsId);

              if (newsError) {
                console.error('Error deleting news:', newsError);
                Alert.alert('Ошибка', 'Не удалось удалить новость. Попробуйте позже.');
                return;
              }

              await fetchNews(sortOption, currentUser);
            } catch (error) {
              console.error('Unexpected error in deleteNews:', error);
              Alert.alert('Ошибка', 'Произошла непредвиденная ошибка при удалении новости.');
            }
          },
        },
      ],
    );
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find((cat) => cat.categoryid === categoryId);
    return category ? category.categoryname : 'Unknown';
  };

  const checkImageExists = async (url: string): Promise<boolean> => {
    try {
      // Если URL содержит путь к файлу в бакете
      if (url.includes('kp02bucket')) {
        // Извлекаем путь к файлу
        const parts = url.split('kp02bucket/');
        if (parts.length > 1) {
          const filePath = parts[1];
          
          // Проверяем наличие файла в бакете
          const { data, error } = await supabase.storage
            .from('kp02bucket')
            .download(filePath);
            
          if (error) {
            console.log('File does not exist in bucket:', filePath);
            return false;
          }
          
          return true;
        }
      }
      
      // Для других URL просто возвращаем true
      return true;
    } catch (error) {
      console.error('Error checking if image exists:', error);
      return false;
    }
  };

  // Функция для проверки и форматирования URL изображения
  const getImageUrl = async (url: string | null | undefined) => {
    if (!url) return null;
    
    console.log('Original URL:', url);
    
    // Если это просто путь к файлу (без http/https), значит это путь в бакете
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Проверяем, начинается ли путь с 'news/'
      const filePath = url.startsWith('news/') ? url : `news/${url}`;
      // Создаем подписанный URL с токеном доступа (действителен 1 час)
      const { data, error } = await supabase.storage.from('kp02bucket').createSignedUrl(filePath, 3600);
      console.log('Created signed URL:', data?.signedUrl);
      return data?.signedUrl || null;
    }
    
    // Если URL уже содержит токен, возвращаем его как есть
    if (url.includes('token=')) {
      return url;
    }
    
    // Проверяем, является ли URL ссылкой на Supabase Storage
    if (url.includes('supabase.co/storage/v1/object/public')) {
      // Извлекаем путь к файлу из URL
      const match = url.match(/public\/([^\/]+)\/(.+)/);
      if (match) {
        const bucket = match[1];
        const filePath = match[2];
        
        // Формируем новый URL с использованием createSignedUrl
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
        console.log('Created signed URL from public URL:', data?.signedUrl);
        return data?.signedUrl || null;
      }
    }
    
    return url;
  };

  const handleImageError = (newsId: number) => {
    console.log(`Image load error for news ${newsId}`);
    setImageLoadErrors(prev => ({...prev, [newsId]: true}));
  };

  const handleSortChange = (value: 'newest' | 'oldest' | 'mostLiked') => {
    setSortOption(value);
    fetchNews(value, currentUser);
  };

  const fetchUserAvatar = async (userId: number) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('avatarurl')
        .eq('userid', userId)
        .single();

      if (userError) throw userError;

      if (userData?.avatarurl) {
        // Если URL начинается с file://, значит это локальный файл
        if (userData.avatarurl.startsWith('file://')) {
          setUserAvatars(prev => ({
            ...prev,
            [userId]: userData.avatarurl
          }));
          return;
        }

        // Если это путь в бакете
        if (!userData.avatarurl.startsWith('http')) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from('kp02bucket')
            .createSignedUrl(userData.avatarurl, 3600);

          if (urlError) throw urlError;

          if (urlData?.signedUrl) {
            setUserAvatars(prev => ({
              ...prev,
              [userId]: urlData.signedUrl
            }));
          }
        } else {
          // Если это уже полный URL
          setUserAvatars(prev => ({
            ...prev,
            [userId]: userData.avatarurl
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching user avatar:', error);
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
        setBuildings(prev => ({
          ...prev,
          [buildingId]: data.address
        }));
      }
    } catch (error) {
      console.error('Error fetching building address:', error);
    }
  };

  const fetchComments = async (newsId: number) => {
    try {
      const { data, error } = await supabase
        .from('comment')
        .select(`
          *,
          user:userid (
            fullname,
            role,
            avatarurl,
            building_id
          )
        `)
        .eq('newsid', newsId)
        .order('commentdate', { ascending: true });

      if (error) throw error;

      if (data) {
        setComments(prev => ({
          ...prev,
          [newsId]: data
        }));

        // Загружаем аватары для всех комментариев
        data.forEach(comment => {
          if (comment.user?.avatarurl) {
            fetchUserAvatar(comment.userid);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (newsId: number) => {
    if (!currentUser || !commentText.trim()) return;

    try {
      const { error } = await supabase
        .from('comment')
        .insert([{
          newsid: newsId,
          userid: currentUser.userid,
          commenttext: commentText.trim(),
          commentdate: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Ошибка', 'Не удалось добавить комментарий. Попробуйте позже.');
        return;
      }

      setCommentText('');
      await fetchComments(newsId);
    } catch (error) {
      console.error('Unexpected error in handleAddComment:', error);
      Alert.alert('Ошибка', 'Произошла непредвиденная ошибка при добавлении комментария.');
    }
  };

  const toggleComments = (newsId: number) => {
    console.log('Toggling comments for newsId:', newsId);
    setSelectedNewsId(newsId);
    setShowComments(true);
    // Добавляем небольшую задержку перед загрузкой комментариев
    setTimeout(() => {
      fetchComments(newsId);
    }, 100);
  };

  const handleCloseComments = () => {
    console.log('Closing comments modal');
    setShowComments(false);
    setSelectedNewsId(null);
    setCommentText('');
  };

  const handleModalPress = (e: any) => {
    e.stopPropagation();
  };

  const deleteComment = async (commentId: number, newsId: number, commentUserId: number) => {
    try {
      const canDelete = currentUser && (
        currentUser.role === 'admin' || 
        currentUser.role === 'moderator' || 
        currentUser.userid === commentUserId
      );

      if (!canDelete) {
        Alert.alert('Ошибка', 'У вас нет прав для удаления этого комментария');
        return;
      }

      const { error } = await supabase
        .from('comment')
        .delete()
        .eq('commentid', commentId);

      if (error) {
        console.error('Error deleting comment:', error);
        Alert.alert('Ошибка', 'Не удалось удалить комментарий. Попробуйте позже.');
        return;
      }

      await fetchComments(newsId);
    } catch (error) {
      console.error('Unexpected error in deleteComment:', error);
      Alert.alert('Ошибка', 'Произошла непредвиденная ошибка при удалении комментария.');
    }
  };

  const handleCommentChange = useCallback((text: string) => {
    setCommentText(text);
  }, []);

  const handleAddCommentPress = useCallback(async () => {
    if (commentText.trim() && selectedNewsId) {
      await handleAddComment(selectedNewsId);
      setCommentText('');
      Keyboard.dismiss();
    }
  }, [commentText, selectedNewsId]);

  const CommentsModalContent = React.memo(() => {
    const newsComments = comments[selectedNewsId || 0] || [];

    return (
      <View style={styles.commentsModalContainer}>
        <View style={styles.commentsModalHeader}>
          <Text style={styles.commentsModalTitle}>Комментарии</Text>
          <TouchableOpacity 
            style={styles.closeCommentsButton}
            onPress={handleCloseComments}
          >
            <Ionicons name="close-circle" size={30} color="#ee8181" />
          </TouchableOpacity>
        </View>

        <View style={styles.commentsContent}>
          {newsComments && newsComments.length > 0 ? (
            <FlatList
              data={newsComments}
              keyExtractor={(item) => item.commentid.toString()}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAuthorContainer}>
                      <View style={styles.avatarContainer}>
                        {userAvatars[item.userid] ? (
                          <Image 
                            source={{ uri: userAvatars[item.userid] }} 
                            style={styles.userAvatar}
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={24} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.userInfoContainer}>
                        <Text style={styles.commentAuthor}>
                          {item.user?.fullname || 'Unknown'}
                        </Text>
                        {item.user?.role && ['admin', 'moderator'].includes(item.user.role) && (
                          <View style={[
                            styles.roleBadge,
                            item.user.role === 'admin' ? styles.adminBadge : styles.moderatorBadge
                          ]}>
                            <Text style={styles.roleText}>
                              {item.user.role === 'admin' ? 'Админ' : 'Модератор'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.commentText}>{item.commenttext}</Text>
                  <View style={styles.commentActions}>
                    <Text style={styles.commentDate}>
                      {new Date(item.commentdate).toLocaleDateString('ru-RU')}
                    </Text>
                    {(currentUser?.role === 'admin' || 
                      currentUser?.role === 'moderator' || 
                      currentUser?.userid === item.userid) && (
                      <TouchableOpacity 
                        style={styles.deleteCommentButton}
                        onPress={() => deleteComment(item.commentid, selectedNewsId || 0, item.userid)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ee8181" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noCommentsContainer}>
              <Text style={styles.noCommentsText}>Нет комментариев</Text>
            </View>
          )}
        </View>

        <View style={styles.commentInputContainer}>
          <View style={styles.commentInputWrapper}>
            <TextInput
              style={styles.commentInput}
              placeholder="Написать комментарий..."
              value={commentText}
              onChangeText={handleCommentChange}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <TouchableOpacity 
              style={[styles.sendButton, !commentText.trim() && styles.commentButtonDisabled]}
              onPress={handleAddCommentPress}
              disabled={!commentText.trim()}
            >
              <Ionicons name="send" size={24} color={commentText.trim() ? "#ee8181" : "#ccc"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  });

  const NewsImage = React.memo(({ uri, newsId, onError }: { uri: string | undefined, newsId: number, onError: (newsId: number) => void }) => {
    const [imageLoading, setImageLoading] = useState(true);

    if (!uri) return null;

    return (
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={[styles.imageContainer, styles.imageLoadingContainer]}>
            <ActivityIndicator size="large" color="#ee8181" />
          </View>
        )}
        <Image
          source={{ 
            uri,
            cache: 'reload'
          }}
          style={[
            styles.newsImage,
            imageLoading && { opacity: 0 }
          ]}
          onLoadStart={() => {
            console.log('Image load started for news:', newsId, 'URL:', uri);
            setImageLoading(true);
          }}
          onLoad={() => {
            console.log('Image loaded successfully for news:', newsId);
            setImageLoading(false);
          }}
          onError={(error) => {
            console.log('Image load error for news:', newsId, 'URL:', uri, 'Error:', error.nativeEvent);
            setImageLoading(false);
            onError(newsId);
          }}
        />
      </View>
    );
  });

  const renderNewsItem = ({ item }: { item: News }) => {
    const canDelete = currentUser?.role === 'admin' || currentUser?.userid === item.authorid;
    const images = [item.imageurl, ...(newsImages[item.newsid] || [])].filter(Boolean);
    
    return (
      <View style={styles.newsItem}>
        <View style={styles.newsContent}>
          {images.length > 0 && !imageLoadErrors[item.newsid] && (
            <NewsImage 
              uri={images[0]} 
              newsId={item.newsid}
              onError={(newsId) => setImageLoadErrors(prev => ({ ...prev, [newsId]: true }))}
            />
          )}
          <View style={styles.newsInfo}>
            <Text style={styles.newsTitle}>{item.title}</Text>
            <Text style={styles.newsText} numberOfLines={3}>
              {item.content}
            </Text>
            <Text style={styles.newsDate}>{formatDate(item.publishdate)}</Text>
            {item.User && (
              <Text style={styles.newsAuthor}>Автор: {item.User.fullname}</Text>
            )}
            <View style={styles.actionsContainer}>
              <View style={styles.likeDislikeContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, item.userLikeStatus === 'like' && styles.activeActionButton]}
                  onPress={() => handleLike(item.newsid, item.userLikeStatus)}
                  disabled={processingLike === item.newsid}
                >
                  <Ionicons
                    name="thumbs-up"
                    size={20}
                    color="#ee8181"
                  />
                  <Text style={[styles.actionText, item.userLikeStatus === 'like' && styles.activeActionText]}>
                    {item.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, item.userLikeStatus === 'dislike' && styles.activeActionButton]}
                  onPress={() => handleDislike(item.newsid, item.userLikeStatus)}
                  disabled={processingLike === item.newsid}
                >
                  <Ionicons
                    name="thumbs-down"
                    size={20}
                    color="#ee8181"
                  />
                  <Text style={[styles.actionText, item.userLikeStatus === 'dislike' && styles.activeActionText]}>
                    {item.dislikes}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.commentButton}
                onPress={() => {
                  setSelectedNewsId(item.newsid);
                  setShowComments(true);
                  fetchComments(item.newsid);
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#ee8181" />
                <Text style={styles.commentCount}>
                  {comments[item.newsid]?.length || 0}
                </Text>
              </TouchableOpacity>

              {canDelete && (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteNews(item.newsid)}
                >
                  <Ionicons name="trash-outline" size={20} color="#ee8181" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderAddModal = () => {
    console.log('Current events:', events);
    console.log('Selected event:', selectedEvent);
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => {
          Keyboard.dismiss();
          setAddModalVisible(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Добавить новость</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setAddModalVisible(false);
                  }}
                >
                  <Ionicons name="close-circle" size={30} color="#ee8181" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  style={styles.input}
                  placeholder="Введите заголовок"
                  placeholderTextColor="#999"
                  value={title}
                  onChangeText={(text) => setTitle(text)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Введите текст новости"
                  placeholderTextColor="#999"
                  value={content}
                  onChangeText={(text) => setContent(text)}
                  multiline
                  numberOfLines={4}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
                <View style={styles.categoryContainer}>
                  <Text style={styles.categoryLabel}>Категория</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.categoryid}
                        style={[
                          styles.categoryButton,
                          selectedCategory === category.categoryid && styles.selectedCategory,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setSelectedCategory(category.categoryid);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryButtonText,
                            selectedCategory === category.categoryid && styles.selectedCategoryText,
                          ]}
                        >
                          {category.categoryname}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.eventContainer}>
                  <Text style={styles.eventLabel}>Прикрепить событие</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventsScroll}>
                    <TouchableOpacity
                      style={[
                        styles.eventButton,
                        selectedEvent === null && styles.selectedEvent,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelectedEvent(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.eventButtonText,
                          selectedEvent === null && styles.selectedEventText,
                        ]}
                      >
                        Без события
                      </Text>
                    </TouchableOpacity>
                    {events && events.length > 0 ? (
                      events.map((event) => (
                        <TouchableOpacity
                          key={event.eventid}
                          style={[
                            styles.eventButton,
                            selectedEvent === event.eventid && styles.selectedEvent,
                          ]}
                          onPress={() => {
                            Keyboard.dismiss();
                            console.log('Selecting event:', event);
                            setSelectedEvent(event.eventid);
                          }}
                        >
                          <Text
                            style={[
                              styles.eventButtonText,
                              selectedEvent === event.eventid && styles.selectedEventText,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {event.eventname}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noEventsText}>Нет доступных событий</Text>
                    )}
                  </ScrollView>
                </View>
                <TouchableOpacity 
                  style={styles.imageButton} 
                  onPress={() => {
                    Keyboard.dismiss();
                    pickImage();
                  }}
                >
                  <Ionicons name="image-outline" size={24} color="#ee8181" />
                  <Text style={styles.imageButtonText}>
                    {selectedImage ? 'Изменить изображение' : 'Добавить изображение'}
                  </Text>
                </TouchableOpacity>
                {selectedImage && (
                  <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
                )}
                <TouchableOpacity
                  style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                  onPress={() => {
                    Keyboard.dismiss();
                    submitNews();
                  }}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Опубликовать</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews(sortOption, currentUser).finally(() => setRefreshing(false));
  }, [sortOption, fetchNews, currentUser]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ee8181" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#ee8181', '#FFFFFF']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Новости</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.sortButton} 
            onPress={() => setSortMenuVisible(!sortMenuVisible)}
          >
            <Ionicons name="filter" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddNews}>
            <Ionicons name="add-circle" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {sortMenuVisible && (
        <View style={styles.sortMenu}>
          <TouchableOpacity 
            style={[styles.sortOption, sortOption === 'newest' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('newest')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'newest' && styles.selectedSortOptionText]}>
              Сначала новые
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortOption, sortOption === 'oldest' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('oldest')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'oldest' && styles.selectedSortOptionText]}>
              Сначала старые
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortOption, sortOption === 'mostLiked' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('mostLiked')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'mostLiked' && styles.selectedSortOptionText]}>
              По популярности
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={news}
        renderItem={renderNewsItem}
        keyExtractor={(item) => item.newsid.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ee8181']}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyList}>Новости не найдены</Text>}
      />

      {showComments && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.commentsModalContainer}>
              <View style={styles.commentsModalHeader}>
                <Text style={styles.commentsModalTitle}>Комментарии</Text>
                <TouchableOpacity 
                  style={styles.closeCommentsButton}
                  onPress={handleCloseComments}
                >
                  <Ionicons name="close-circle" size={30} color="#ee8181" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
              >
                <View style={styles.commentsContent}>
                  {comments[selectedNewsId || 0]?.length > 0 ? (
                    <FlatList
                      data={comments[selectedNewsId || 0]}
                      keyExtractor={(item) => item.commentid.toString()}
                      renderItem={({ item }) => (
                        <View style={styles.commentItem}>
                          <View style={styles.commentHeader}>
                            <View style={styles.commentAuthorContainer}>
                              <View style={styles.avatarContainer}>
                                {userAvatars[item.userid] ? (
                                  <Image 
                                    source={{ uri: userAvatars[item.userid] }} 
                                    style={styles.userAvatar}
                                  />
                                ) : (
                                  <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="person" size={24} color="#fff" />
                                  </View>
                                )}
                              </View>
                              <View style={styles.userInfoContainer}>
                                <Text style={styles.commentAuthor}>
                                  {item.user?.fullname || 'Unknown'}
                                </Text>
                                {item.user?.role && ['admin', 'moderator'].includes(item.user.role) && (
                                  <View style={[
                                    styles.roleBadge,
                                    item.user.role === 'admin' ? styles.adminBadge : styles.moderatorBadge
                                  ]}>
                                    <Text style={styles.roleText}>
                                      {item.user.role === 'admin' ? 'Админ' : 'Модератор'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                          <Text style={styles.commentText}>{item.commenttext}</Text>
                          <View style={styles.commentActions}>
                            <Text style={styles.commentDate}>
                              {new Date(item.commentdate).toLocaleDateString('ru-RU')}
                            </Text>
                            {(currentUser?.role === 'admin' || 
                              currentUser?.role === 'moderator' || 
                              currentUser?.userid === item.userid) && (
                              <TouchableOpacity 
                                style={styles.deleteCommentButton}
                                onPress={() => deleteComment(item.commentid, selectedNewsId || 0, item.userid)}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ee8181" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                      style={styles.commentsList}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 80 }}
                    />
                  ) : (
                    <View style={styles.noCommentsContainer}>
                      <Text style={styles.noCommentsText}>Нет комментариев</Text>
                    </View>
                  )}
                </View>

                <View style={styles.commentInputContainer}>
                  <View style={styles.commentInputWrapper}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Написать комментарий..."
                      value={commentText}
                      onChangeText={handleCommentChange}
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity 
                      style={[styles.sendButton, !commentText.trim() && styles.commentButtonDisabled]}
                      onPress={handleAddCommentPress}
                      disabled={!commentText.trim()}
                    >
                      <Ionicons name="send" size={24} color={commentText.trim() ? "#ee8181" : "#ccc"} />
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>
      )}

      {renderAddModal()}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    padding: 5,
    marginLeft: 10,
  },
  sortButton: {
    padding: 5,
  },
  sortMenu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  listContainer: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingBottom: 100,
    width: '100%',
  },
  newsItem: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
    width: SCREEN_WIDTH * 0.92,
  },
  newsContent: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  newsInfo: {
    padding: 15,
  },
  newsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ee8181',
  },
  newsText: {
    fontSize: 14,
    color: '#333',
    marginTop: 6,
  },
  newsDate: {
    fontSize: 14,
    color: '#666',
  },
  newsAuthor: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  likeDislikeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  activeActionButton: {
    backgroundColor: '#f9e0e0',
    borderRadius: 15,
    padding: 5,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  activeActionText: {
    color: '#ee8181',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 'auto',
    marginLeft: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  commentCount: {
    color: '#666',
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  emptyList: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.8,
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ee8181',
  },
  closeButton: {
    padding: 8,
  },
  scrollContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  input: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginBottom: 20,
    width: '100%',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  eventContainer: {
    marginBottom: 20,
    width: '100%',
  },
  eventLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  categoriesScroll: {
    width: '100%',
  },
  eventsScroll: {
    width: '100%',
  },
  categoryButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 100,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: '#ee8181',
    borderColor: '#ee8181',
  },
  categoryButtonText: {
    color: '#666',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#fff',
  },
  eventButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 150,
    maxWidth: 200,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEvent: {
    backgroundColor: '#ee8181',
    borderColor: '#ee8181',
  },
  eventButtonText: {
    color: '#666',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  selectedEventText: {
    color: '#fff',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
  },
  imageButtonText: {
    marginLeft: 10,
    color: '#666',
    fontWeight: 'bold',
  },
  selectedImagePreview: {
    width: '100%',
    height: SCREEN_WIDTH * 0.5,
    borderRadius: 10,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#ee8181',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentsContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentInputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingRight: 10,
  },
  commentInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  commentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#eee',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ee8181',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ee8181',
    marginRight: 6,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    marginTop: 6,
    marginLeft: 48,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 48,
    marginTop: 4,
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
  },
  deleteCommentButton: {
    padding: 2,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadge: {
    backgroundColor: '#ff6b6b',
  },
  moderatorBadge: {
    backgroundColor: '#4dabf7',
  },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  commentsModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    height: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  commentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  commentsModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ee8181',
  },
  closeCommentsButton: {
    padding: 8,
  },
  commentsContent: {
    flex: 1,
  },
  commentsList: {
    flex: 1,
  },
  commentButtonDisabled: {
    opacity: 0.5,
  },
  sortOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  selectedSortOption: {
    backgroundColor: '#f9e0e0',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#666',
  },
  selectedSortOptionText: {
    color: '#ee8181',
    fontWeight: 'bold',
  },
  noEventsText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default React.memo(NewsScreen);