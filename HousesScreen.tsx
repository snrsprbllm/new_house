import React, { useState, useEffect, useMemo } from 'react';
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
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseClient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

// Define screen dimensions for responsive design
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ResidentialBuilding {
  buildingid: number;
  numberofapartments: number;
  yearofconstruction: number;
  address: string;
  imageurl: string;
  imageurl1?: string;
  imageurl2?: string;
  imageurl3?: string;
  imageurl4?: string;
  imageurl5?: string;
  imageurl6?: string;
  imageurl7?: string;
  imageurl8?: string;
  imageurl9?: string;
  companyid: number;
}

interface ManagementCompany {
  companyid: number;
  companyname: string;
  address: string;
  imageurl: string;
  rating: number | null;
}

interface Review {
  reviewid: number;
  userid: number;
  companyid: number;
  rating: number;
  reviewtext: string;
  reviewdate: string;
}

const HousesScreen: React.FC = () => {
  const [buildings, setBuildings] = useState<ResidentialBuilding[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<ResidentialBuilding | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [companies, setCompanies] = useState<ManagementCompany[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<{[key: number]: number}>({});

  useEffect(() => {
    fetchBuildings();
    fetchCompanies();
    fetchCurrentUser();
    getCurrentLocation();
  }, []);

  const fetchBuildings = async () => {
    try {
      console.log('Fetching buildings...');
      const { data, error } = await supabase
        .from('residentialbuilding')
        .select('*');

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      console.log('Buildings data:', data);
      setBuildings(data || []);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const fetchCompanies = async () => {
    try {
      // Загружаем все компании
      const { data: companiesData, error: companiesError } = await supabase
        .from('managementcompany')
        .select('*');

      if (companiesError) {
        throw new Error(companiesError.message);
      }

      // Загружаем все отзывы
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('review')
        .select('*');

      if (reviewsError) {
        throw new Error(reviewsError.message);
      }

      // Вычисляем средний рейтинг для каждой компании
      const companiesWithRating = companiesData.map((company) => {
        const companyReviews = reviewsData.filter(
          (review) => review.companyid === company.companyid
        );

        const ratings = companyReviews.map((review) => review.rating);
        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : null;

        return {
          ...company,
          rating: averageRating, // Добавляем средний рейтинг в объект компании
        };
      });

      setCompanies(companiesWithRating);
    } catch (error) {
      console.error('Error fetching companies:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
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
      Alert.alert('Ошибка', `Не удалось загрузить данные пользователя: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Необходим доступ к геолокации');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Получаем адрес по координатам
      const response = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (response[0]) {
        const { city, street, name } = response[0];
        const locationString = `${city || ''} ${street || ''} ${name || ''}`.trim();
        setCurrentLocation(locationString);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleBuildingPress = (building: ResidentialBuilding) => {
    setSelectedBuilding(building);
    setModalVisible(true);
  };

  const handleSortChange = (companyId: number | null) => {
    setSelectedCompany(companyId);
    setSortMenuVisible(false);
  };

  const filteredBuildings = useMemo(() => {
    if (selectedCompany === null) {
      return buildings;
    }
    return buildings.filter(building => building.companyid === selectedCompany);
  }, [buildings, selectedCompany]);

  const getBuildingImages = (building: ResidentialBuilding): string[] => {
    const images: string[] = [];
    if (building.imageurl) images.push(building.imageurl);
    for (let i = 1; i <= 9; i++) {
      const imageKey = `imageurl${i}` as keyof ResidentialBuilding;
      const imageUrl = building[imageKey];
      if (imageUrl && typeof imageUrl === 'string') {
        images.push(imageUrl);
      }
    }
    return images;
  };

  const renderBuildingItem = ({ item }: { item: ResidentialBuilding }) => {
    const company = companies.find(c => c.companyid === item.companyid);
    const images = getBuildingImages(item);
    
    return (
      <TouchableOpacity style={styles.buildingItem} onPress={() => handleBuildingPress(item)}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: images[0] }}
            style={styles.buildingImage}
          />
        </View>
        <View style={styles.buildingInfo}>
          {company && (
            <Text style={styles.companyName}>{company.companyname}</Text>
          )}
          <Text style={styles.buildingName}>{item.address}</Text>
          <Text style={styles.buildingDetails}>Год постройки: {item.yearofconstruction}</Text>
          <Text style={styles.buildingDetails}>Количество квартир: {item.numberofapartments}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCompanyInfo = (companyId: number) => {
    const company = companies.find((c) => c.companyid === companyId);
    if (!company) return null;

    return (
      <View style={styles.companyInfo}>
        <View style={styles.companyHeader}>
          <Text style={styles.companyName}>Управляющая компания:</Text>
          <Text style={styles.companyName}>{company.companyname}</Text>
        </View>
        <Text style={styles.companyAddress}>Адрес компании: {company.address}</Text>
        <View style={styles.companyImageContainer}>
          <Image source={{ uri: company.imageurl }} style={styles.companyImage} />
        </View>
        <Text style={styles.companyRating}>
          Рейтинг: {company.rating !== null ? company.rating.toFixed(1) : 'Н/Д'}
        </Text>
      </View>
    );
  };

  const openMap = (address: string) => {
    const query = encodeURIComponent(address);
    let url = '';
    if (Platform && Platform.OS === 'ios') {
      url = `http://maps.apple.com/?q=${query}`;
    } else {
      url = `geo:0,0?q=${query}`;
    }
    
    if (currentLocation) {
      Alert.alert(
        'Геолокация',
        `Ваша геопозиция: ${currentLocation}`,
        [
          {
            text: 'Открыть карту',
            onPress: () => Linking.openURL(url).catch(err => console.error("Не удалось загрузить страницу", err))
          },
          {
            text: 'Отмена',
            style: 'cancel'
          }
        ]
      );
    } else {
      Linking.openURL(url).catch(err => console.error("Не удалось загрузить страницу", err));
    }
  };

  const deleteBuilding = async (buildingId: number) => {
    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to delete buildings.');
      return;
    }

    Alert.alert(
      'Удаление дома',
      'Вы уверены, что хотите удалить этот дом?',
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
                .from('residentialbuilding')
                .delete()
                .eq('buildingid', buildingId);

              if (error) {
                throw new Error(error.message);
              }

              // Обновляем список домов
              await fetchBuildings();
            } catch (error) {
              console.error('Error deleting building:', error);
              Alert.alert('Error', (error as Error).message || 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const handleImagePicker = async () => {
    try {
      if (Platform && Platform.OS === 'ios') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Ошибка', 'Нужно разрешение для доступа к галерее');
          return;
        }
      }
    } catch (error) {
      console.error('Error handling image picker:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const renderModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setModalVisible(false)}
        >
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {selectedBuilding && (
              <>
                <View style={styles.modalImageSlider}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const newIndex = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH * 0.92));
                      setCurrentImageIndex(prev => ({
                        ...prev,
                        [selectedBuilding.buildingid]: newIndex
                      }));
                    }}
                  >
                    {getBuildingImages(selectedBuilding).map((image, index) => (
                      <View key={index} style={{ width: SCREEN_WIDTH * 0.92 }}>
                        <Image
                          source={{ uri: image }}
                          style={styles.modalImage}
                        />
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.modalPaginationDots}>
                    {getBuildingImages(selectedBuilding).map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          index === (currentImageIndex[selectedBuilding.buildingid] || 0) && styles.activeDot
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.modalTitle}>{selectedBuilding.address}</Text>
                <Text style={styles.modalText}>Год постройки: {selectedBuilding.yearofconstruction}</Text>
                <Text style={styles.modalText}>Количество квартир: {selectedBuilding.numberofapartments}</Text>
                {renderCompanyInfo(selectedBuilding.companyid)}
              </>
            )}
          </ScrollView>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.modalButton} onPress={() => openMap(selectedBuilding?.address || '')}>
              <Text style={styles.buttonText}>Показать на карте</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Жилые дома</Text>
        <TouchableOpacity 
          style={styles.sortButton} 
          onPress={() => setSortMenuVisible(!sortMenuVisible)}
        >
          <Ionicons name="filter" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {sortMenuVisible && (
        <View style={styles.sortMenu}>
          <TouchableOpacity 
            style={[styles.sortOption, selectedCompany === null && styles.selectedSortOption]} 
            onPress={() => handleSortChange(null)}
          >
            <Text style={[styles.sortOptionText, selectedCompany === null && styles.selectedSortOptionText]}>
              Все дома
            </Text>
          </TouchableOpacity>
          {companies.map((company) => (
            <TouchableOpacity 
              key={company.companyid}
              style={[styles.sortOption, selectedCompany === company.companyid && styles.selectedSortOption]} 
              onPress={() => handleSortChange(company.companyid)}
            >
              <Text style={[styles.sortOptionText, selectedCompany === company.companyid && styles.selectedSortOptionText]}>
                {company.companyname}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <FlatList
        data={filteredBuildings}
        renderItem={renderBuildingItem}
        keyExtractor={(item) => item.buildingid.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyList}>Дома не найдены</Text>}
      />

      {renderModal()}
    </View>
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
    paddingTop: Platform && Platform.OS === 'ios' ? 50 : 45,
    height: Platform && Platform.OS === 'ios' ? 90 : 85,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  listContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 100,
    width: '100%',
  },
  buildingItem: {
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
  imageContainer: {
    width: SCREEN_WIDTH * 0.92,
    marginRight: 10,
    height: 200,
    position: 'relative',
  },
  buildingImage: {
    width: SCREEN_WIDTH * 0.92,
    marginRight: 10,
    height: 200,
    resizeMode: 'cover',
  },
  buildingInfo: {
    padding: SCREEN_WIDTH * 0.046,
  },
  companyName: {
    fontSize: SCREEN_WIDTH * 0.046,
    color: '#ee8181',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buildingName: {
    fontSize: SCREEN_WIDTH * 0.046,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  buildingDetails: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
    lineHeight: SCREEN_WIDTH * 0.052,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform && Platform.OS === 'ios' ? 50 : 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: Platform && Platform.OS === 'ios' ? 53 : 43,
    right: 20,
    zIndex: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 8,
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 100,
  },
  modalImageSlider: {
    width: SCREEN_WIDTH * 0.92,
    height: 300,
    position: 'relative',
    marginBottom: 20,
    alignSelf: 'center',
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalImage: {
    width: SCREEN_WIDTH * 0.92,
    height: 300,
    resizeMode: 'cover',
  },
  modalPaginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    width: '100%',
    zIndex: 1,
  },
  modalTitle: {
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    color: '#ee8181',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    backgroundColor: '#ee8181',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
  },
  companyInfo: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  companyHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  companyName1: {
    fontSize: SCREEN_WIDTH * 0.046,
    color: '#ee8181',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
  },
  companyAddress: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  companyImageContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  companyImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
  },
  companyRating: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#ee8181',
    marginTop: 5,
    textAlign: 'center',
  },
  emptyList: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    width: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#ee8181',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ee8181',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: Platform && Platform.OS === 'ios' ? 50 : 40,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default HousesScreen;