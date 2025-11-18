import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient();

// Wrapper condicional para GestureHandlerRootView (no funciona en web)
const GestureWrapper = Platform.OS === 'web' 
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : GestureHandlerRootView;

export default function App() {
  const Wrapper = Platform.OS === 'web' 
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => (
        <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
      );

  return (
    <Wrapper>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </Wrapper>
  );
}

