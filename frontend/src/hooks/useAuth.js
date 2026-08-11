import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useApi } from './useApi';

export function useAuth() {
  const authStore = useAuthStore();
  const { loading, error, request } = useApi();

  const login = useCallback(async (username, password) => {
    try {
      // Authenticate to retrieve JWT
      const tokenData = await request('post', '/auth/login', { username, password });
      
      // Fetch user profile using the newly retrieved token
      const user = await request('get', '/auth/me', null, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      
      // Save in store & localStorage
      authStore.loginSuccess(tokenData.access_token, user);
      return user;
    } catch (err) {
      throw err;
    }
  }, [request, authStore]);

  const register = useCallback(async (username, email, password, role) => {
    try {
      return await request('post', '/auth/register', { username, email, password, role });
    } catch (err) {
      throw err;
    }
  }, [request]);

  const logout = useCallback(() => {
    authStore.logout();
  }, [authStore]);

  return {
    login,
    register,
    logout,
    loading,
    error,
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated
  };
}
