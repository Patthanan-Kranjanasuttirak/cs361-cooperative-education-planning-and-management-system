import { createContext } from 'react';

// { user, token, authError, login, loginWithGoogle, logout, updateUser } — ดู AuthProvider.jsx
export const AuthContext = createContext(null);
