import React from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface AuthFormProps {
  handleChange: (field: string) => (text: string) => void;
  handleBlur: (field: string) => () => void;
  handleSubmit: () => void;
  values: { email: string; password: string };
  errors: { [key: string]: string };
  touched: { [key: string]: boolean };
  buttonText: string;
}

const AuthForm: React.FC<AuthFormProps> = ({
  handleChange,
  handleBlur,
  handleSubmit,
  values,
  errors,
  touched,
  buttonText,
}) => {
  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Email"
        onChangeText={handleChange('email')}
        onBlur={handleBlur('email')}
        value={values.email}
        keyboardType="email-address"
      />
      {touched.email && errors.email && <Text style={styles.error}>{errors.email}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Password"
        onChangeText={handleChange('password')}
        onBlur={handleBlur('password')}
        value={values.password}
        secureTextEntry
      />
      {touched.password && errors.password && <Text style={styles.error}>{errors.password}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    height: 40,
    borderColor: '#FF0000',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FF0000',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#FF0000',
    marginBottom: 8,
  },
});

export default AuthForm;