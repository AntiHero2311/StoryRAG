import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserInfo } from '../utils/jwtHelper';

export interface UserInfo {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userInfo = getUserInfo(token);
      setUser(userInfo);
    } catch (error) {
      console.error('Failed to parse user info:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    navigate('/login');
  };

  const isAuthenticated = !!user;

  return {
    user,
    loading,
    isAuthenticated,
    logout,
  };
}
