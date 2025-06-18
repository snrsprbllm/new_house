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
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseClient';
import { Ionicons } from '@expo/vector-icons';

// Define screen dimensions for responsive design
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Company {
  companyid: number;
  companyname: string;
  address: string;
  imageurl: string;
  rating: number | null;
  company_number: string;
}

interface ResidentialBuilding {
  buildingid: number;
  numberofapartments: number;
  yearofconstruction: number;
  address: string;
  imageurl: string;
}

interface Review {
  reviewid: number;
  userid: number;
  companyid: number;
  rating: number;
  reviewtext: string;
  reviewdate: string;
}

interface SupabaseError {
  message: string;
}

const ManagingCompaniesScreen: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [buildings, setBuildings] = useState<ResidentialBuilding[]>([]);
  const [hasReviewed, setHasReviewed] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sortOption, setSortOption] = useState<'all' | 'high' | 'low'>('all');

  useEffect(() => {
    fetchCompanies();
    fetchCurrentUser();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('managementcompany')
        .select('*');

      if (companiesError) {
        throw new Error(companiesError.message);
      }

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('review')
        .select('*');

      if (reviewsError) {
        throw new Error(reviewsError.message);
      }

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
          rating: averageRating,
        };
      });

      setCompanies(companiesWithRating);
    } catch (error) {
      console.error('Error fetching companies:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const fetchBuildingsForCompany = async (companyId: number) => {
    try {
      const { data, error } = await supabase
        .from('residentialbuilding')
        .select('*')
        .eq('companyid', companyId);

      if (error) {
        throw new Error((error as SupabaseError).message);
      }
      setBuildings(data || []);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const checkIfReviewed = async (companyId: number) => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (!userString) {
        setHasReviewed(false);
        return;
      }

      const user = JSON.parse(userString);
      if (!user.userid) {
        setHasReviewed(false);
        return;
      }

      const userId = parseInt(user.userid, 10);
      if (isNaN(userId)) {
        setHasReviewed(false);
        return;
      }

      const { data, error } = await supabase
        .from('review')
        .select('*')
        .eq('companyid', companyId)
        .eq('userid', userId);

      if (error) {
        throw new Error((error as SupabaseError).message);
      }

      setHasReviewed(data && data.length > 0);
    } catch (error) {
      console.error('Error checking review:', error);
      Alert.alert('Error', (error as Error).message || 'Unknown error');
    }
  };

  const handleCompanyPress = async (company: Company) => {
    setSelectedCompany(company);
    await fetchBuildingsForCompany(company.companyid);

    const userRating = await fetchUserRating(company.companyid);
    if (userRating !== null) {
      setRating(userRating);
      setHasReviewed(true);
    } else {
      setRating(0);
      setHasReviewed(false);
    }

    setModalVisible(true);
  };

  const handleStarPress = (starIndex: number) => {
    if (!hasReviewed) {
      setRating(starIndex + 1);
    }
  };

  const handleRatingSubmit = async () => {
    if (selectedCompany && !hasReviewed) {
      try {
        const userString = await AsyncStorage.getItem('user');
        if (!userString) {
          Alert.alert('Error', 'You need to be logged in to submit a rating.');
          return;
        }

        const user = JSON.parse(userString);
        if (!user.userid) {
          Alert.alert('Error', 'User data is missing.');
          return;
        }

        const userId = parseInt(user.userid, 10);
        if (isNaN(userId)) {
          Alert.alert('Error', 'Invalid user ID.');
          return;
        }

        const { error } = await supabase
          .from('review')
          .insert([
            {
              userid: userId,
              companyid: selectedCompany.companyid,
              rating: rating,
              reviewtext: '',
              reviewdate: new Date().toISOString().split('T')[0],
            },
          ]);

        if (error) {
          throw new Error(error.message);
        }

        await fetchCompanies();
        setHasReviewed(true);
        Alert.alert('Success', 'Rating submitted successfully!');
      } catch (error) {
        console.error('Error submitting rating:', error);
        Alert.alert('Error', (error as Error).message || 'Unknown error');
      }
    } else {
      Alert.alert('Error', 'You have already reviewed this company.');
    }
  };

  const fetchUserRating = async (companyId: number) => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (!userString) {
        return null;
      }

      const user = JSON.parse(userString);
      if (!user.userid) {
        return null;
      }

      const userId = parseInt(user.userid, 10);
      if (isNaN(userId)) {
        return null;
      }

      const { data, error } = await supabase
        .from('review')
        .select('rating')
        .eq('companyid', companyId)
        .eq('userid', userId);

      if (error) {
        throw new Error(error.message);
      }

      return data && data.length > 0 ? data[0].rating : null;
    } catch (error) {
      console.error('Error fetching user rating:', error);
      return null;
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

  const deleteCompany = async (companyId: number) => {
    if (!currentUser) {
      Alert.alert('Error', 'You need to be logged in to delete companies.');
      return;
    }

    Alert.alert(
      'Удаление компании',
      'Вы уверены, что хотите удалить эту компанию?',
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
                .from('managementcompany')
                .delete()
                .eq('companyid', companyId);

              if (error) {
                throw new Error(error.message);
              }

              // Обновляем список компаний
              await fetchCompanies();
            } catch (error) {
              console.error('Error deleting company:', error);
              Alert.alert('Error', (error as Error).message || 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const handleSortChange = (option: 'all' | 'high' | 'low') => {
    setSortOption(option);
    setSortMenuVisible(false);
  };

  const sortedCompanies = useMemo(() => {
    const companiesWithRating = [...companies];
    switch (sortOption) {
      case 'high':
        return companiesWithRating.sort((a, b) => {
          if (a.rating === null) return 1;
          if (b.rating === null) return -1;
          return b.rating - a.rating;
        });
      case 'low':
        return companiesWithRating.sort((a, b) => {
          if (a.rating === null) return 1;
          if (b.rating === null) return -1;
          return a.rating - b.rating;
        });
      default:
        return companiesWithRating;
    }
  }, [companies, sortOption]);

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <TouchableOpacity style={styles.companyItem} onPress={() => handleCompanyPress(item)}>
      <View style={styles.companyImageContainer}>
        <Image source={{ uri: item.imageurl }} style={styles.companyImage} />
      </View>
      <View style={styles.companyInfo}>
        <Text style={styles.companyName}>{item.companyname}</Text>
        <Text style={styles.companyAddress}>{item.address}</Text>
        <View style={styles.ratingContainer}>
          {renderStars(item.rating || 0)}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < rating) {
        stars.push(
          <TouchableOpacity
            key={i}
            onPress={() => !hasReviewed && handleStarPress(i)}
            disabled={hasReviewed}
          >
            <Text style={styles.starFilled}>★</Text>
          </TouchableOpacity>
        );
      } else {
        stars.push(
          <TouchableOpacity
            key={i}
            onPress={() => !hasReviewed && handleStarPress(i)}
            disabled={hasReviewed}
          >
            <Text style={styles.starEmpty}>☆</Text>
          </TouchableOpacity>
        );
      }
    }
    return <View style={styles.starsContainer}>{stars}</View>;
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
            {selectedCompany && (
              <>
                <View style={styles.modalImageSlider}>
                  <Image
                    source={{ uri: selectedCompany.imageurl }}
                    style={styles.modalImage}
                  />
                </View>
                <Text style={styles.modalTitle}>{selectedCompany.companyname}</Text>
                <Text style={styles.modalText}>Адрес: {selectedCompany.address}</Text>
                <Text style={styles.modalText}>Номер компании: {selectedCompany.company_number}</Text>
                <View style={styles.ratingContainer}>
                  <Text style={styles.ratingText}>Рейтинг: {selectedCompany.rating?.toFixed(1) || 'Н/Д'}</Text>
                  {renderStars(selectedCompany.rating || 0)}
                </View>
                <Text style={styles.buildingsTitle}>Обслуживаемые дома:</Text>
                {buildings.length > 0 ? (
                  buildings.map((building) => (
                    <View key={building.buildingid} style={styles.buildingItem}>
                      <Image
                        source={{ uri: building.imageurl }}
                        style={styles.buildingImage}
                      />
                      <View style={styles.buildingInfo}>
                        <Text style={styles.buildingAddress}>{building.address}</Text>
                        <Text style={styles.buildingDetails}>
                          Год постройки: {building.yearofconstruction}
                        </Text>
                        <Text style={styles.buildingDetails}>
                          Количество квартир: {building.numberofapartments}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noBuildingsText}>Нет обслуживаемых домов</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Управляющие компании</Text>
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
            style={[styles.sortOption, sortOption === 'all' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('all')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'all' && styles.selectedSortOptionText]}>
              Все компании
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortOption, sortOption === 'high' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('high')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'high' && styles.selectedSortOptionText]}>
              По убыванию рейтинга
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortOption, sortOption === 'low' && styles.selectedSortOption]} 
            onPress={() => handleSortChange('low')}
          >
            <Text style={[styles.sortOptionText, sortOption === 'low' && styles.selectedSortOptionText]}>
              По возрастанию рейтинга
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={sortedCompanies}
        renderItem={renderCompanyItem}
        keyExtractor={(item) => item.companyid.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyList}>Компании не найдены</Text>}
      />

      {renderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  companyItem: {
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
  companyImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  companyImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  companyInfo: {
    padding: SCREEN_WIDTH * 0.046,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ee8181',
  },
  companyAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  starFilled: {
    fontSize: 24,
    color: '#ee8181',
  },
  starEmpty: {
    fontSize: 24,
    color: '#ccc',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    top: Platform && Platform.OS === 'ios' ? 53 : 43,
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
  },
  modalImageSlider: {
    width: SCREEN_WIDTH * 0.92,
    height: 300,
    position: 'relative',
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalImage: {
    width: SCREEN_WIDTH * 0.92,
    height: 300,
    resizeMode: 'cover',
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
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ee8181',
    marginLeft: 10,
  },
  buildingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ee8181',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  buildingItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginVertical: 5,
    width: '100%',
  },
  buildingImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  buildingInfo: {
    alignItems: 'center',
  },
  buildingAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  buildingDetails: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 3,
  },
  noBuildingsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
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
  emptyList: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
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

export default ManagingCompaniesScreen;